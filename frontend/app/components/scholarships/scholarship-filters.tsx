import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import {
  FUNDING_TYPES,
  STUDY_LEVELS,
  type ScholarshipFilters,
} from "@/app/lib/scholarships/filters";
import { titleCase } from "@/app/lib/scholarships/format";

export function ScholarshipFiltersForm({
  filters,
}: {
  filters: ScholarshipFilters;
}) {
  return (
    <form className="scholarship-filters" method="get" action="/scholarships">
      <div className="scholarship-search">
        <label htmlFor="scholarship-search">Search scholarships</label>
        <span>
          <Search aria-hidden="true" />
          <input
            id="scholarship-search"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Title, provider, field, or description"
          />
        </span>
      </div>
      <details className="scholarship-filter-panel">
        <summary>
          <SlidersHorizontal aria-hidden="true" /> Filters and sort
        </summary>
        <div className="scholarship-filter-grid">
          <FilterSelect
            name="study_level"
            label="Study level"
            value={filters.study_level}
          >
            <option value="">Any level</option>
            {STUDY_LEVELS.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </FilterSelect>
          <FilterInput
            name="field"
            label="Field"
            value={filters.field}
            placeholder="e.g. Engineering"
          />
          <FilterInput
            name="destination"
            label="Destination country"
            value={filters.destination}
            placeholder="ISO code, e.g. GB"
            maxLength={2}
          />
          <FilterInput
            name="nationality"
            label="Your nationality"
            value={filters.nationality}
            placeholder="ISO code, e.g. BW"
            maxLength={2}
          />
          <FilterInput
            name="residency"
            label="Your residency"
            value={filters.residency}
            placeholder="ISO code, e.g. BW"
            maxLength={2}
          />
          <FilterSelect
            name="funding_type"
            label="Funding type"
            value={filters.funding_type}
          >
            <option value="">Any funding</option>
            {FUNDING_TYPES.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </FilterSelect>
          <FilterInput
            name="deadline_from"
            label="Deadline from"
            value={filters.deadline_from}
            type="date"
          />
          <FilterInput
            name="deadline_to"
            label="Deadline to"
            value={filters.deadline_to}
            type="date"
          />
          <FilterSelect name="sort" label="Sort by" value={filters.sort}>
            <option value="relevance">Relevance</option>
            <option value="deadline">Deadline</option>
            <option value="recently_verified">Recently verified</option>
            <option value="funding_amount">
              Funding amount (comparable only)
            </option>
          </FilterSelect>
          <label className="scholarship-filter-check">
            <input
              name="verified"
              type="checkbox"
              value="true"
              defaultChecked={filters.verified}
            />
            Verified opportunities only
          </label>
        </div>
        <div className="scholarship-filter-actions">
          <Link href="/scholarships">Clear filters</Link>
          <button className="product-button product-button--ink" type="submit">
            Apply filters
          </button>
        </div>
      </details>
    </form>
  );
}

function FilterInput({
  label,
  name,
  value,
  type = "text",
  ...props
}: {
  label: string;
  name: string;
  value?: string;
  type?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <label className="scholarship-filter-field">
      <span>{label}</span>
      <input name={name} type={type} defaultValue={value} {...props} />
    </label>
  );
}

function FilterSelect({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="scholarship-filter-field">
      <span>{label}</span>
      <select name={name} defaultValue={value}>
        {children}
      </select>
    </label>
  );
}
