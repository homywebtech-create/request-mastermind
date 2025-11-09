import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

interface VirtualizedTableProps<T> {
  data: T[];
  columns: {
    key: string;
    header: string | React.ReactNode;
    render: (item: T) => React.ReactNode;
    className?: string;
  }[];
  estimateSize?: number;
  overscan?: number;
  className?: string;
  rowClassName?: (item: T) => string;
  emptyMessage?: string;
}

export function VirtualizedTable<T extends { id: string }>({
  data,
  columns,
  estimateSize = 80,
  overscan = 5,
  className,
  rowClassName,
  emptyMessage = "No data available",
}: VirtualizedTableProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={cn("relative w-full overflow-auto", className)}
      style={{ height: "calc(100vh - 300px)", minHeight: "400px" }}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            <>
              {/* Spacer for virtual scroll */}
              {virtualItems.length > 0 && (
                <tr style={{ height: `${virtualItems[0].start}px` }} />
              )}
              
              {/* Render only visible items */}
              {virtualItems.map((virtualRow) => {
                const item = data[virtualRow.index];
                return (
                  <TableRow
                    key={item.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className={rowClassName ? rowClassName(item) : undefined}
                  >
                    {columns.map((column) => (
                      <TableCell key={`${item.id}-${column.key}`} className={column.className}>
                        {column.render(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
              
              {/* Spacer for remaining scroll space */}
              {virtualItems.length > 0 && (
                <tr
                  style={{
                    height: `${
                      rowVirtualizer.getTotalSize() -
                      (virtualItems[virtualItems.length - 1]?.end || 0)
                    }px`,
                  }}
                />
              )}
            </>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
