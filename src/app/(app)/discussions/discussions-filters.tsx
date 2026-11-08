"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface DiscussionsFiltersProps {
  categories: readonly string[];
  currentCategory: string;
  currentSearch: string;
}

export function DiscussionsFilters({
  categories,
  currentCategory,
  currentSearch,
}: DiscussionsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(currentSearch);

  // Debounce search → URL.
  React.useEffect(() => {
    const t = setTimeout(() => {
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      if (search.trim()) {
        sp.set("q", search.trim());
      } else {
        sp.delete("q");
      }
      const qs = sp.toString();
      router.replace(qs ? `/discussions?${qs}` : "/discussions", {
        scroll: false,
      });
    }, 250);
    return () => clearTimeout(t);
  }, [search, router, searchParams]);

  const onCategoryChange = (value: string) => {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    if (value === "all") {
      sp.delete("category");
    } else {
      sp.set("category", value);
    }
    const qs = sp.toString();
    router.replace(qs ? `/discussions?${qs}` : "/discussions", {
      scroll: false,
    });
  };

  const clearAll = () => {
    setSearch("");
    router.replace("/discussions", { scroll: false });
  };

  const hasFilters = currentCategory !== "all" || Boolean(currentSearch);

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search thread titles…"
          className="h-9 pl-9"
          aria-label="Search discussions"
        />
      </div>
      <Select value={currentCategory} onValueChange={onCategoryChange}>
        <SelectTrigger size="sm" className="h-9 w-[220px]" aria-label="Filter by category">
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={clearAll}
        >
          <X className="size-4" />
          Clear
        </Button>
      ) : null}
    </div>
  );
}
