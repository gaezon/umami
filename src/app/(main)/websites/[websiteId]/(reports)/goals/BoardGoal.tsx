import { Text } from '@umami/react-zen';
import { EmptyPlaceholder } from '@/components/common/EmptyPlaceholder';
import { LoadingPanel } from '@/components/common/LoadingPanel';
import { useDateRange } from '@/components/hooks';
import { useReportQuery } from '@/components/hooks/queries/useReportQuery';
import { Goal } from './Goal';

export function BoardGoal({ websiteId, reportId }: { websiteId: string; reportId?: string }) {
  const {
    dateRange: { startDate, endDate },
  } = useDateRange();
  const { data, isLoading, error, isFetching } = useReportQuery(reportId || '');

  if (!reportId) {
    return <EmptyPlaceholder title="Select a saved goal" description="Choose an existing goal." />;
  }

  if (data && (data.type !== 'goal' || data.websiteId !== websiteId)) {
    return (
      <EmptyPlaceholder
        title="Goal unavailable"
        description="This saved goal is no longer available for the selected website."
      />
    );
  }

  return (
    <LoadingPanel data={data} isLoading={isLoading} isFetching={isFetching} error={error}>
      {data ? (
        <Goal
          id={data.id}
          name={data.name}
          type={data.type}
          parameters={data.parameters}
          websiteId={websiteId}
          startDate={startDate}
          endDate={endDate}
          allowEdit={false}
        />
      ) : (
        <Text color="muted">Goal unavailable</Text>
      )}
    </LoadingPanel>
  );
}
