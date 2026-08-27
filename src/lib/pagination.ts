export const PAGE_SIZE_OPTIONS = ["10", "25", "50", "all"] as const;
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSizeOption = "10";

export function parsePageSize(raw: string | string[] | undefined): PageSizeOption {
  const value = typeof raw === "string" ? raw : DEFAULT_PAGE_SIZE;
  return (PAGE_SIZE_OPTIONS as readonly string[]).includes(value) ? (value as PageSizeOption) : DEFAULT_PAGE_SIZE;
}

export function parsePage(raw: string | string[] | undefined): number {
  const n = typeof raw === "string" ? Number(raw) : 1;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

export function paginate(total: number, page: number, size: PageSizeOption) {
  const pageSize = size === "all" ? null : Number(size);
  const totalPages = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const skip = pageSize ? (currentPage - 1) * pageSize : undefined;
  const take = pageSize ?? undefined;
  const rangeStart = total === 0 ? 0 : pageSize ? (currentPage - 1) * pageSize + 1 : 1;
  const rangeEnd = pageSize ? Math.min(currentPage * pageSize, total) : total;
  return { pageSize, totalPages, currentPage, skip, take, rangeStart, rangeEnd };
}

/** Builds a page URL, preserving any extra query params already on the page (e.g. status filters). */
export function buildPageHref(
  basePath: string,
  params: { size: PageSizeOption; page: number },
  extraParams?: Record<string, string>
) {
  const qs = new URLSearchParams(extraParams);
  if (params.size !== DEFAULT_PAGE_SIZE) qs.set("size", params.size);
  else qs.delete("size");
  if (params.page > 1) qs.set("page", String(params.page));
  else qs.delete("page");
  const query = qs.toString();
  return `${basePath}${query ? `?${query}` : ""}`;
}
