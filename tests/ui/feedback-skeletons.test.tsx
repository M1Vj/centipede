import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  CardSkeletonList,
  DetailSectionSkeleton,
  FormSkeleton,
  TableSkeleton,
} from "@/components/ui/feedback-skeletons";

describe("feedback skeletons", () => {
  test("renders the expected number of reusable placeholders", () => {
    render(
      <>
        <CardSkeletonList count={2} />
        <TableSkeleton rows={3} />
        <FormSkeleton fields={3} />
        <DetailSectionSkeleton lines={2} />
      </>,
    );

    expect(screen.getAllByTestId("card-skeleton-item")).toHaveLength(2);
    expect(screen.getAllByTestId("table-skeleton-row")).toHaveLength(3);
    expect(screen.getAllByTestId("form-skeleton-field")).toHaveLength(3);
    expect(screen.getAllByTestId("detail-skeleton-line")).toHaveLength(2);
  });
});
