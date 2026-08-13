"use client"

// Table sort + column-filter state for the Sell Put (Wheel) Scanner, extracted
// from components/scanner/use-wheel-scanner.ts (P6-13 module-size work — zero
// behavior change).
//
// Three tables sort independently and each has its own default, which is the
// reason this is one hook rather than three: the defaults are a set, and a set
// is easier to keep straight in one place than scattered through a 690-line
// pipeline. Nothing here touches the scan; it is presentation state only.

import { useState } from "react"
import type { QualifyingStock, RelaxedFilters } from "./types"

export function useScannerSorting() {
  const [fundamentalSortColumn, setFundamentalSortColumn] = useState<string>("ticker")
  const [fundamentalSortDirection, setFundamentalSortDirection] = useState<"asc" | "desc">("asc")
  const [showAllFundamentals, setShowAllFundamentals] = useState(false)

  // Default: rank finalists by annualized premium yield — the "richest premium first" view
  const [sortColumn, setSortColumn] = useState<keyof QualifyingStock>("annualizedYield")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  // Default: shortest DTE first, then highest Yield % within each DTE group
  const [relaxedSortColumn, setRelaxedSortColumn] = useState<keyof QualifyingStock>("daysToExpiry")
  const [relaxedSortDirection, setRelaxedSortDirection] = useState<"asc" | "desc">("asc")

  // Excel-style column filters for the relaxed results table. Empty string = no filter.
  const [relaxedFilters, setRelaxedFilters] = useState<RelaxedFilters>({
    ticker: "",
    maxDTE: "",
    minPremium: "",
    minYield: "",
    minAnnualYield: "",
    minIV: "",
  })
  const clearRelaxedFilters = () =>
    setRelaxedFilters({ ticker: "", maxDTE: "", minPremium: "", minYield: "", minAnnualYield: "", minIV: "" })

  const handleFundamentalSort = (column: string) => {
    if (fundamentalSortColumn === column) {
      setFundamentalSortDirection(fundamentalSortDirection === "asc" ? "desc" : "asc")
    } else {
      setFundamentalSortColumn(column)
      setFundamentalSortDirection("desc")
    }
  }

  const handleRelaxedSort = (column: keyof QualifyingStock) => {
    if (relaxedSortColumn === column) {
      setRelaxedSortDirection(relaxedSortDirection === "asc" ? "desc" : "asc")
    } else {
      setRelaxedSortColumn(column)
      setRelaxedSortDirection("asc")
    }
  }

  const handleSort = (column: keyof QualifyingStock) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  return {
    fundamentalSortColumn, fundamentalSortDirection, handleFundamentalSort,
    showAllFundamentals, setShowAllFundamentals,
    sortColumn, sortDirection, handleSort,
    relaxedSortColumn, relaxedSortDirection, handleRelaxedSort,
    relaxedFilters, setRelaxedFilters, clearRelaxedFilters,
  }
}
