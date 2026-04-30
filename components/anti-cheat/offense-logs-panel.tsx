'use client'

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { OffenseLog } from "@/lib/anti-cheat/queries"
import { format } from "date-fns"

interface OffenseLogsPanelProps {
  logs: OffenseLog[]
}

export function OffenseLogsPanel({ logs }: OffenseLogsPanelProps) {
  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Anti-Cheat Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No cheating offenses logged yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anti-Cheat Logs ({logs.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm text-left border-y sm:border-y-0 text-muted-foreground sm:text-foreground">
            <thead className="text-xs uppercase bg-muted/50 text-muted-foreground whitespace-nowrap">
              <tr>
                <th className="px-4 sm:px-6 py-4 font-semibold border-b">Time</th>
                <th className="px-4 sm:px-6 py-4 font-semibold border-b">Participant</th>
                <th className="px-4 sm:px-6 py-4 font-semibold border-b text-center">Offense #</th>
                <th className="px-4 sm:px-6 py-4 font-semibold border-b">Penalty Applied</th>
                <th className="px-4 sm:px-6 py-4 font-semibold border-b">Event Type</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => {
                const reg = log.competition_attempts?.competition_registrations;
                const name = reg?.teams?.name || reg?.profiles?.full_name || 'Unknown';

                return (
                  <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap font-medium text-foreground">
                      {format(new Date(log.logged_at), 'HH:mm:ss')}
                    </td>
                    <td className="px-4 sm:px-6 py-4 font-medium text-foreground max-w-[200px] sm:max-w-[300px] truncate" title={name}>
                      {name}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-center">
                      <Badge variant="outline">{log.offense_number}</Badge>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <Badge variant={log.penalty_applied === 'none' ? 'secondary' : 'destructive'} className="whitespace-nowrap">
                        {log.penalty_applied}
                      </Badge>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-muted-foreground whitespace-nowrap">
                      {(log.metadata_json.event_source as string) || 'unknown'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
