import { Text } from '@umami/react-zen';
import { EmptyPlaceholder } from '@/components/common/EmptyPlaceholder';
import { LoadingPanel } from '@/components/common/LoadingPanel';
import { useReportQuery } from '@/components/hooks/queries/useReportQuery';
import { Funnel } from './Funnel';

export function BoardFunnel({ websiteId, reportId }: { websiteId: string; reportId?: string }) {
  const { data, isLoading, error, isFetching } = useReportQuery(reportId || '');

  if (!reportId) {
    return (
      <EmptyPlaceholder title="Select a saved funnel" description="Choose an existing funnel." />
    );
  }

  if (data && (data.type !== 'funnel' || data.websiteId !== websiteId)) {
    return (
      <EmptyPlaceholder
        title="Funnel unavailable"
        description="This saved funnel is no longer available for the selected website."
      />
    );
  }

  return (
    <LoadingPanel data={data} isLoading={isLoading} isFetching={isFetching} error={error}>
      {data ? (
        <Funnel
          id={data.id}
          name={data.name}
          type={data.type}
          parameters={data.parameters}
          websiteId={websiteId}
          allowEdit={false}
        />
      ) : (
        <Text color="muted">Funnel unavailable</Text>
      )}
    </LoadingPanel>
  );
}
