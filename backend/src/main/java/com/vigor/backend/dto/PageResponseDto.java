package com.vigor.backend.dto;

import java.util.List;

/** Standard envelope for paginated collections. */
public record PageResponseDto<T>(
        List<T> items,
        int page,
        int pageSize,
        long totalElements,
        int totalPages,
        boolean hasNext
) {

    public static <T> PageResponseDto<T> of(List<T> items, int page, int pageSize) {
        long total = items.size();
        int totalPages = (int) Math.ceil(total / (double) pageSize);
        int from = Math.min(page * pageSize, items.size());
        int to = Math.min(from + pageSize, items.size());
        return new PageResponseDto<>(
                items.subList(from, to),
                page,
                pageSize,
                total,
                Math.max(totalPages, 1),
                to < items.size());
    }
}
