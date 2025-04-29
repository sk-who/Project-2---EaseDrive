"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { getUserTags, searchFilesByTag } from "@/lib/actions/tag.actions";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

interface TagSearchProps {
  onSearch?: (files: any[]) => void;
}

const TagSearch = ({ onSearch }: TagSearchProps) => {
  const [searchInput, setSearchInput] = useState("");
  const [tags, setTags] = useState<
    Array<{ id: string; name: string; tagId: string }>
  >([]);
  const [filteredTags, setFilteredTags] = useState<
    Array<{ id: string; name: string; tagId: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  // Fetch all user tags on component mount
  useEffect(() => {
    const fetchTags = async () => {
      setIsLoading(true);
      try {
        const userTags = await getUserTags();
        setTags(userTags);
        setFilteredTags(userTags);
      } catch (error) {
        console.error("Failed to fetch tags:", error);
        toast({
          title: "Error",
          description: "Failed to load tag suggestions",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
  }, [toast]);

  // Filter tags based on search input
  useEffect(() => {
    if (searchInput.trim() === "") {
      setFilteredTags(tags);
    } else {
      const filtered = tags.filter((tag) =>
        tag.name.toLowerCase().includes(searchInput.toLowerCase())
      );
      setFilteredTags(filtered);
    }
  }, [searchInput, tags]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    if (e.target.value.trim() !== "") {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleTagSelect = async (tagName: string) => {
    setSearchInput(tagName);
    setShowSuggestions(false);
    setIsSearching(true);

    try {
      const { files } = await searchFilesByTag(tagName);

      // If onSearch callback is provided, pass the search results
      if (onSearch) {
        onSearch(files);
      } else {
        // Otherwise, navigate to search results page
        router.push(`/?searchTag=${encodeURIComponent(tagName)}`);
      }

      // Show message based on search results
      if (!files || files.length === 0) {
        toast({
          title: "No files found",
          description: `No files with the tag "${tagName}" were found`,
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Failed to search files by tag:", error);
      toast({
        title: "Search Error",
        description: "Failed to search files by tag. Please try again.",
        variant: "destructive",
      });

      // Return empty results on error
      if (onSearch) {
        onSearch([]);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchInput.trim() !== "") {
      // If enter is pressed, select the first tag from filtered list or search directly
      if (filteredTags.length > 0) {
        handleTagSelect(filteredTags[0].name);
      } else {
        handleTagSelect(searchInput.trim());
      }
    }
  };

  return (
    <div className="relative w-full" ref={searchRef}>
      <div className="relative flex items-center">
        <Image
          src="/assets/icons/search.svg"
          alt="Search"
          width={24}
          height={24}
          className="absolute left-3 top-1/2 transform -translate-y-1/2"
        />
        <Input
          placeholder="Search by tags..."
          value={searchInput}
          onChange={handleSearchChange}
          onKeyDown={handleKeyPress}
          onFocus={() => {
            if (searchInput.trim() !== "") {
              setShowSuggestions(true);
            }
          }}
          className="pl-10 pr-10 h-11 border-gray-300 dark:border-gray-600 focus-visible:ring-2 focus-visible:ring-offset-1"
          disabled={isSearching || isLoading}
        />
        {searchInput && !isSearching && !isLoading && (
          <button
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={() => {
              setSearchInput("");
              setShowSuggestions(false);
            }}
          >
            <Image
              src="/assets/icons/close.svg"
              alt="Clear search"
              width={16}
              height={16}
            />
          </button>
        )}
        {(isSearching || isLoading) && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Image
              src="/assets/icons/loader.svg"
              alt="Loading"
              width={18}
              height={18}
              className="animate-spin"
            />
          </div>
        )}
      </div>

      {showSuggestions && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
          <ul className="py-1">
            {filteredTags.length > 0 ? (
              filteredTags.map((tag) => (
                <li
                  key={tag.id}
                  className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center"
                  onClick={() => handleTagSelect(tag.name)}
                >
                  <Image
                    src="/assets/icons/search.svg"
                    alt="Tag"
                    width={16}
                    height={16}
                    className="mr-2 opacity-50"
                  />
                  <span>{tag.name}</span>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-gray-500 dark:text-gray-400">
                {isLoading ? "Loading tags..." : "No matching tags found"}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TagSearch;
