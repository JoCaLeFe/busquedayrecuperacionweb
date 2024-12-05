import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardInfo
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
import { Loader2, Search, X } from "lucide-react";
import { Switch } from "./components/ui/switch";
import { Label } from "@radix-ui/react-label";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function SearchPage() {
  const [url, setUrl] = useState("");
  const [depth, setDepth] = useState("1");
  const [suggestions, setSuggestions] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [facets, setFacets] = useState({});
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isLoadingCrawl, setIsLoadingCrawl] = useState(false);
  const suggestionsRef = useRef(null);
  const [lastSelectedQuery, setLastSelectedQuery] = useState("");
  const [shouldExpandQuery, setShouldExpandQuery] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [corrections, setCorrections] = useState([]);
  const [selectedFacets, setSelectedFacets] = useState([]);

  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") || "";

  // Update query setting logic:
  const handleQueryChange = (newQuery) => {
    setSearchParams({ q: newQuery });
  };

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
    if (depth > 1) alert("Buscando...", "La profundidad 2 puede tardar mucho");
    try {
      const response = await axios.post("http://localhost:3001/api/crawl", {
        url,
        depth: parseInt(depth),
      });
      const documentCount = response.data.crawledUrls.length;
      alert(
        "Crawling completado",
        `Se indexaron ${documentCount} ${
          documentCount === 1 ? "documento" : "documentos"
        }`
      );
    } catch (error) {
      console.error("Error crawling:", error);
      alert("Error", "Ocurrió un error al crawlear", "destructive");
    } finally {
      setIsLoadingCrawl(false);
      setUrl("");
    }
  };

  const handleFacetClick = (facetName, facetValue) => {
    setSelectedFacets([facetName, facetValue]);
  };

  const searchWebsite = async (expandQuery) => {
    setSuggestions([]);
    setIsLoadingSearch(true);
    console.log("expandQuery", expandQuery);
    try {
      const response = await axios.get(
        `http://localhost:3001/api/search?q=${query}&facet=${selectedFacets[0] ?? ""}:${selectedFacets[1] ?? ""}&expand=${expandQuery}`
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
    if (query) {
      searchWebsite(shouldExpandQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedFacets.length !== 0) {
      searchWebsite(shouldExpandQuery);
      setSelectedFacets([]);
    }
  }, [selectedFacets]);

  useEffect(() => {
    if (query === lastSelectedQuery) {
      return;
    }
    const timer = setTimeout(() => {
    getSuggestions(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, lastSelectedQuery, searchResults]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      setSuggestions([]);
    } else if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      handleQueryChange(suggestions[0].term);
      setLastSelectedQuery(suggestions[0].term);
      setSuggestions([]);
    }
    if (e.key === "ArrowDown") {
      suggestionsRef.current.firstChild.focus();
    }
    if (e.key === "ArrowUp") {
      suggestionsRef.current.lastChild.focus();
    }
    if (e.key === "Enter") {
      searchWebsite(shouldExpandQuery);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    handleQueryChange(suggestion.term);
    setLastSelectedQuery(suggestion.term);
    setSuggestions([]);
  };

  return (
    <div className="relative flex flex-col mx-auto h-[100svh]">
      {/* Search Bar Section */}
      <div className="bg-background sticky top-0 py-4 px-6 flex h-fit w-full gap-4 items-center justify-between border-b">
        <div className="flex gap-2 items-center flex-grow max-w-fit">

          <img src="moonrlogo.svg" className="size-8" />
          <img src="moonr.svg" className="hidden md:flex max-w-36 h-4 md:h-auto" />

        </div>
        <div className="relative flex flex-grow max-w-4xl">
          <Input
            type="text"
            placeholder="Buscar..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            size="icon"
            onClick={() => searchWebsite(shouldExpandQuery)}
            disabled={isLoadingSearch}
          >
            {isLoadingSearch ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
          {suggestions.length > 0 && (
            <ul
              ref={suggestionsRef}
              className="absolute top-11 rounded-b-lg z-10 bg-white border border-gray-300 w-full"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={index}
                  className="p-2 hover:bg-gray-100 cursor-pointer text-sm"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion.term}
                </li>
              ))}
              <Button variant='destructive' size='icon' className='absolute top-0 right-0' onClick={()=>setSuggestions([])}>
                <X/>
              </Button>
              </ul>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="expand-query"
            checked={shouldExpandQuery}
            onCheckedChange={setShouldExpandQuery}
          />
          <Label htmlFor="expand-query" className="text-xs sm:text-sm">
            Expandir consulta
          </Label>
        </div>
      </div>
      {/* Main Section */}
      <div className="min-h-0 flex h-full flex-col md:flex-row ">
        {/* Left Sidebar - Facets */}
        <div className="h-full p-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Más opciones</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Crawl Controls */}
              <div className="mb-6 space-y-4">
                <h3 className="text-sm">Crawlear nuevo sitio</h3>
                <Input
                  type="url"
                  placeholder="https://ejemplo.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="mb-2"
                />
                <Select value={depth} onValueChange={setDepth}>
                  <SelectTrigger>
                    <SelectValue placeholder="Profundidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Profundidad 1</SelectItem>
                    <SelectItem value="2">Profundidad 2</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  disabled={isLoadingCrawl}
                  onClick={crawlWebsite}
                  className="w-full"
                  variant="outline"
                >
                  {isLoadingCrawl && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isLoadingCrawl ? "Crawleando..." : "Crawlear sitio"}
                </Button>
              </div>

              {/* Facets */}
              {facets && Object.keys(facets).length > 0 && (
                <div className="space-y-4">
                  {Object.entries(facets).map(([facetName, facetValues]) => (
                    <div key={facetName}>
                      <h3 className="font-medium mb-2">
                        {facetName === "doc_type" ? "Tipo" : "Autor"}
                      </h3>
                      <div className="flex flex-col gap-2">
                        {facetValues
                          .filter((_, i) => i % 2 === 0)
                          .map((value, index) => (
                            <div
                              key={index}
                              className="flex justify-between w-fit items-center gap-2"
                              onClick={() => handleFacetClick(facetName, value)}
                            >
                              <span className="text-xs">{value}</span>
                              <Badge key={index}>
                                {facetValues[index * 2 + 1]}
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Search Results */}
        <div className="flex-grow h-full p-4">
          <div className="max-h-full overflow-auto">
            {isLoadingSearch ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <SearchResultSkeleton key={i} />
                ))}
              </div>
            ) : (
              searchResults &&
              searchResults.response && (
                <div className="space-y-4">
                  {searchResults.response.docs.map((doc) => (
                    <Card key={doc.id} className="max-w-[80ch]">
                      <CardHeader>
                        <CardTitle className="hover:underline text-lg">
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
                          className="text-sm"
                          dangerouslySetInnerHTML={{
                            __html:
                              searchResults.highlighting[doc.id]
                                ?.content?.[0] || "No hay snippet disponible",
                          }}
                        />
                      </CardContent>
                      <CardInfo>
                        <p className="text-sm"><strong>Relevancia: </strong>{doc.score}</p>
                        <p className="text-sm"><strong>Autor: </strong>{doc.author ? doc.author : 'N/A'}</p>
                        <p className="text-sm"><strong>Tipo: </strong>{doc.doc_type}</p>
                      </CardInfo>
                    </Card>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const SearchResultSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-2/3 mb-2 bg-slate-200" />
      <Skeleton className="h-4 w-1/2 bg-slate-200" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-16 w-full bg-slate-200" />
    </CardContent>
  </Card>
);
