from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = None
    page_query_param = "page"

    def paginate_queryset(self, queryset, request, view=None):
        limit = request.query_params.get("limit")
        if limit is not None:
            try:
                self.page_size = int(limit)
            except (ValueError, TypeError):
                pass

        sort_by = request.query_params.get("sortBy", None)
        order = request.query_params.get("order", "asc")

        if sort_by:
            if order.lower() == "desc":
                sort_field = f"-{sort_by}"
            else:
                sort_field = sort_by

            try:
                queryset = queryset.order_by(sort_field)
            except Exception:
                pass

        return super().paginate_queryset(queryset, request, view)

    def get_paginated_response(self, data):
        return Response(
            {
                "count": self.page.paginator.count,
                "total_pages": self.page.paginator.num_pages,
                "current_page": self.page.number,
                "results": data,
            }
        )
