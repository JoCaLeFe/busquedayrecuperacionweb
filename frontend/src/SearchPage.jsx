"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import axios from "axios";
import { useToast } from "./hooks/use-toast";
import { Skeleton } from "./components/ui/skeleton";
import { Loader2 } from "lucide-react";
import { Switch } from "./components/ui/switch";
import { Label } from "@radix-ui/react-label";

export default function SearchPage() {
  const [url, setUrl] = useState("");
  const [depth, setDepth] = useState("1");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [facets, setFacets] = useState({});
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isLoadingCrawl, setIsLoadingCrawl] = useState(false);
  const suggestionsRef = useRef(null);
  const [lastSelectedQuery, setLastSelectedQuery] = useState("");
  const [shouldExpandQuery, setShouldExpandQuery] = useState(false);

  const { toast } = useToast();

  const alert = (title, description, variant = "default") => {
    return toast({
      title,
      description,
      variant,
    });
  };

  const crawlWebsite = async () => {
    setIsLoadingCrawl(true);
    if (depth > 1) alert("Advertencia", "La profundidad 2 puede tardar mucho");
    try {
      const response = await axios.post("http://localhost:3001/api/crawl", {
        url,
        depth: parseInt(depth),
      });
      alert(
        "Crawling completado",
        `Se indexaron ${response.data.crawledUrls.length} documentos`
      );
    } catch (error) {
      console.error("Error crawling:", error);
      alert("Error", "Ocurrió un error al crawlear", "destructive");
    } finally {
      setIsLoadingCrawl(false);
      setUrl("");
    }
  };

  const searchWebsite = async (expandQuery) => {
    setIsLoadingSearch(true);
    console.log("expandQuery", expandQuery);

    try {
      const response = await axios.get(
        `http://localhost:3001/api/search?q=${query}&expand=${expandQuery}`
      );
      setSearchResults(response.data);
      setFacets(response.data.facet_counts.facet_fields);
      if (expandQuery)
        alert("Tu query fue expandida a", response.data.finalQuery);
    } catch (error) {
      console.error("Error searching:", error);
      alert("Error", "Ocurrió un error al buscar", "destructive");
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const getSuggestions = async (value) => {
    if (value.length < 2) return setSuggestions([]);
    try {
      const response = await axios.get(
        `http://localhost:3001/api/suggest?q=${value}`
      );
      setSuggestions(response.data.suggestions);
    } catch (error) {
      console.error("Error getting suggestions:", error);
    }
  };

  useEffect(() => {
    if (query === lastSelectedQuery) {
      return;
    }

    const timer = setTimeout(() => {
      getSuggestions(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, lastSelectedQuery]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setSuggestions([]);
    } else if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      setQuery(suggestions[0].term);
      setLastSelectedQuery(suggestions[0].term);
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion.term);
    setLastSelectedQuery(suggestion.term);
    setSuggestions([]);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold mb-4">Buscador Solr</h1>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Input
          type="url"
          placeholder="Ingresa una URL completa para crawlear (ej. https://example.com)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Select value={depth} onValueChange={setDepth}>
          <SelectTrigger className="w-full mb-2">
            <SelectValue placeholder="Selecciona la profundidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1 (obtiene solo una página)</SelectItem>
            <SelectItem value="2">
              2 (obtiene la URL provista + todas las contenidas)
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          disabled={isLoadingCrawl}
          onClick={crawlWebsite}
          className="col-span-2 max-w-xl"
        >
          {isLoadingCrawl && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoadingCrawl ? "Crawleando..." : "Crawlear sitio"}
        </Button>
      </div>

      <div className="grid grid-cols-2 relative gap-2 mb-4">
        <div className="relative ">
          <Input
            type="text"
            placeholder="Buscar..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-16 text-lg placeholder:text-lg"
          />
          {suggestions.length > 0 && (
            <ul
              ref={suggestionsRef}
              className="absolute z-10 bg-white border border-gray-300 w-full"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={index}
                  className="p-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion.term}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="expand-query"
            checked={shouldExpandQuery}
            onCheckedChange={setShouldExpandQuery}
          />
          <Label htmlFor="expand-query" className="text-sm">
            Expandir consulta
          </Label>
        </div>

        <Button
          onClick={() => searchWebsite(shouldExpandQuery)}
          className="col-span-2 max-w-xl"
          disabled={isLoadingSearch}
        >
          {isLoadingSearch && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isLoadingSearch ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {facets && Object.keys(facets).length > 0 && (
        <div className="mb-4">
          {Object.entries(facets).map(([facetName, facetValues]) => (
            <div key={facetName} className="mb-2">
              <h3 className="text-lg font-medium">
                {facetName === "doc_type" ? "Tipo" : "Autor"}
              </h3>
              <div className="flex flex-wrap gap-2">
                {facetValues
                  .filter((_, i) => i % 2 === 0)
                  .map((value, index) => (
                    <Badge key={index} variant="secondary">
                      {value} ({facetValues[index * 2 + 1]})
                    </Badge>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoadingSearch ? (
        <div>
          {[1, 2, 3].map((i) => (
            <SearchResultSkeleton key={i} />
          ))}
        </div>
      ) : (
        searchResults &&
        searchResults.response && (
          <div>
            {searchResults.response.docs.map((doc) => (
              <Card key={doc.id} className="mb-4">
                <CardHeader>
                  <CardTitle className="hover:underline">
                    <a href={doc.url} target="_blank" rel="noreferrer">
                      {doc.title}
                    </a>
                  </CardTitle>
                  <CardDescription className="hover:underline">
                    <a href={doc.url} target="_blank" rel="noreferrer">
                      {decodeURIComponent(doc.url)}
                    </a>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p
                    className="line-clamp-3 overflow-hidden text-ellipsis"
                    dangerouslySetInnerHTML={{
                      __html:
                        searchResults.highlighting[doc.id]?.content?.[0] ||
                        "No hay snippet disponible",
                    }}
                  ></p>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}

const SearchResultSkeleton = () => (
  <Card className="mb-4">
    <CardHeader>
      <Skeleton className="h-6 w-2/3 mb-2" />
      <Skeleton className="h-4 w-1/2" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-16 w-full" />
    </CardContent>
  </Card>
);
