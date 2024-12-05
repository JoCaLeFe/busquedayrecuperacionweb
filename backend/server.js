// server.js
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const { convert } = require("html-to-text");
const { CohereClientV2 } = require("cohere-ai");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");

const cohere = new CohereClientV2({
  token: "4CDMDIZHFjWYY70VUhbXtptiJgYdf3WGwujNA2SS",
});

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${
      file.originalname
    }`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

const app = express();
app.use(cors());
app.use(express.json());

const SOLR_URL = process.env.SOLR_URL || "http://localhost:8983/solr/briw";

function getDomain(urlString) {
  return new URL(urlString).hostname;
}
function extractLinks($, baseUrl) {
  const domain = getDomain(baseUrl);
  const links = new Set();

  $("a").each((i, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    try {
      const url = new URL(href, baseUrl);
      if (
        url.hostname === domain &&
        url.protocol.startsWith("http") &&
        !url.href.includes("#")
      ) {
        links.add(url.href);
      }
    } catch (e) {}
  });

  return Array.from(links);
}
function isValidUrl(url) {
  // Skip common non-HTML file extensions
  const invalidExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".pdf",
    ".doc",
    ".docx",
    ".zip",
    ".rar",
    ".exe",
    ".css",
    ".js",
    ".ico",
    ".svg",
  ];
  const urlPath = new URL(url).pathname.toLowerCase();
  return !invalidExtensions.some((ext) => urlPath.endsWith(ext));
}

async function expandQuery(query) {
  try {
    const response = await cohere.chat({
      model: "command-r-plus-08-2024",
      messages: [
        {
          role: "user",
          content: `Genera un arreglo JSON de 3 sinónimos o palabras relacionadas a '${query}' en español.`,
        },
      ],
      responseFormat: {
        type: "json_object",
        jsonSchema: {
          type: "object",
          properties: {
            synonyms: {
              type: "array",
              items: {
                type: "string",
              },
            },
          },
          required: ["synonyms"],
        },
      },
    });

    const text = response.message.content[0].text;
    const synonyms = JSON.parse(text).synonyms;
    return [...synonyms, query];
  } catch (error) {
    console.log(error);
    return query;
  }
}

app.post("/api/crawl", async (req, res) => {
  try {
    const { url, depth } = req.body;
    const visitedUrls = new Set();
    const MAX_DEPTH = depth || 2;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }
    if (depth && isNaN(depth)) {
      return res.status(400).json({ error: "Depth must be a number" });
    }
    if (depth && depth > MAX_DEPTH) {
      return res.status(400).json({ error: "Depth is too high" });
    }

    async function crawlPage(pageUrl, depth = 1) {
      console.log(`Crawling ${pageUrl} at depth ${depth}`);

      if (
        depth > MAX_DEPTH ||
        visitedUrls.has(pageUrl) ||
        !isValidUrl(pageUrl)
      ) {
        console.log(
          `Skipping ${pageUrl} because it's invalid or visited at depth ${depth} or depth is too high`
        );
        return;
      }

      visitedUrls.add(pageUrl);

      try {
        console.log(`Fetching ${pageUrl}`);

        const response = await axios.get(pageUrl, {
          headers: {
            Accept: "text/html",
          },
          validateStatus: (status) => status === 200,
        });

        // Check if response is HTML
        const contentType = response.headers["content-type"] || "";
        if (!contentType.includes("text/html")) {
          console.log(`Skipping ${pageUrl} because it's not HTML`);
          return;
        }

        const $ = cheerio.load(response.data);

        // Verify page has body
        if (!$("body").length) {
          console.log(`Skipping ${pageUrl} because it has no body`);
          return;
        }

        const title = $("title").text();
        const author = $('meta[name="author"]').attr("content") || "";
        $(
          "script, style, button, img, input, form, select, textarea, iframe"
        ).remove();

        const content = convert($("body").html(), {
          wordwrap: false,
          preserveNewlines: false,
          selectors: [
            {
              selector: "a", options: { ignoreHref: true },
            },
          ],
        });

        const doc = {
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          url: pageUrl,
          title,
          content_suggest: content,
          author,
          timestamp: new Date().toISOString(),
          doc_type: "webpage",
        };


        console.log(`Indexing ${pageUrl}`);

        await axios.post(`${SOLR_URL}/update/json/docs`, doc, {
          headers: { "Content-Type": "application/json" },
          params: { commit: true },
        });

        console.log(`Indexed ${pageUrl}`);

        if (MAX_DEPTH === 1) {
          console.log(
            `User requested depth of 1, skipping links extraction for ${pageUrl}`
          );
          return;
        }

        if (depth === MAX_DEPTH) {
          console.log(
            `Reached max depth of ${MAX_DEPTH} for ${pageUrl}, no need to extract links`
          );
          return;
        }

        console.log(`Extracting links from ${pageUrl}`);

        const links = extractLinks($, pageUrl);
        for (const link of links) {
          await crawlPage(link, depth + 1);
        }
      } catch (error) {
        console.log(`Failed to crawl ${pageUrl}: ${error.message}`);
      }
    }

    await crawlPage(url);
    console.log(
      `Crawling completed with ${visitedUrls.size} documents indexed`
    );

    res.json({
      success: true,
      crawledUrls: Array.from(visitedUrls),
      depth,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    let { q, expand, facet } = req.query;

    const originalQuery = q;

    expand = expand === "true";

    if (expand) {
      const expandedQuery = await expandQuery(q);
      q = expandedQuery.join(" OR ");
    }

    const params = {
      q,
      defType: "edismax",
      qf: "title^2 content^1",
      hl: true,
      "hl.fragsize": 40,
      "hl.tag.pre": "<strong>",
      "hl.tag.post": "</strong>",
      fl: "id,url,title,author,doc_type,score",
      facet: true,
    };

    if (facet !== ":") {
      params.fq = facet;
    }

    var newParams = new URLSearchParams(params);

    newParams.append("facet.field", "doc_type");
    newParams.append("facet.field", "author_facet");

    const request = {
      params: newParams,
    };

    const response = await axios.get(`${SOLR_URL}/spell`, request);

    res.json({ originalQuery, finalQuery: q, ...response.data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/suggest", async (req, res) => {
  try {
    const params = req.query;
    const q = params.q;

    const response = await axios.get(`${SOLR_URL}/suggest`, {
      params,
    });

    res.json(response.data.suggest.mySuggester[q]);
  } catch (error) {
    //console.log(error);
    //res.status(500).json({ error: error.message });
  }
});

app.post("/api/upload/pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const filePath = req.file.path;
    const fileData = await fs.promises.readFile(filePath);

    // Parse PDF content
    const pdfData = await pdfParse(fileData);

    // Create document for Solr
    const doc = {
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      url: `${req.protocol}://${req.get("host")}/${req.file.filename}`,
      title: req.file.originalname.replace(".pdf", ""),
      content_suggest: pdfData.text,
      author: pdfData.info?.Author || "",
      timestamp: new Date().toISOString(),
      doc_type: "pdf",
    };

    // Index to Solr
    await axios.post(`${SOLR_URL}/update/json/docs`, doc, {
      headers: { "Content-Type": "application/json" },
      params: { commit: true },
    });

    res.json({
      success: true,
      message: "PDF uploaded and indexed successfully",
      document: doc,
    });
  } catch (error) {
    console.error("PDF upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;

app.use(express.static(path.join(__dirname, "uploads")));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
