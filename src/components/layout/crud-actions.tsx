"use client";

import React, { useEffect, useRef, useState } from "react";
import { Edit3, Search, Trash2 } from "lucide-react";
import { ActionButton } from "./action-bar";

interface CrudActionsProps {
  /** A row is selected in the table. */
  hasSelection: boolean;
  onModify: () => void;
  onDelete: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  /** Accessible label for the search input. */
  searchLabel: string;
  searchPlaceholder: string;
}

/**
 * The three ActionBar actions shared by every CRUD screen:
 * Buscar (toggles/focuses the search field), Modificar and Eliminar (accent, disabled
 * without a selected row). Search input lives here — never inside the table.
 */
export function CrudActions({
  hasSelection,
  onModify,
  onDelete,
  searchTerm,
  onSearchChange,
  searchLabel,
  searchPlaceholder,
}: CrudActionsProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggleSearch = () => {
    if (searchOpen) {
      onSearchChange("");
      setSearchOpen(false);
    } else {
      setSearchOpen(true);
    }
  };

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  return (
    <>
      {searchOpen && (
        <div className="flex h-10 items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3">
          <Search size={16} className="text-[#71717A]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            aria-label={searchLabel}
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-full w-52 bg-transparent text-sm text-[#333333] outline-none placeholder:text-[#A1A5B0]"
          />
        </div>
      )}
      <ActionButton icon={Search} label="Buscar" onClick={toggleSearch} />
      <ActionButton
        icon={Edit3}
        label="Modificar"
        variant="accent"
        disabled={!hasSelection}
        onClick={onModify}
      />
      <ActionButton
        icon={Trash2}
        label="Eliminar"
        variant="accent"
        disabled={!hasSelection}
        onClick={onDelete}
      />
    </>
  );
}
