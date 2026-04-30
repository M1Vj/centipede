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
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs uppercase bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Participant</th>
                <th className="px-4 py-3">Offense #</th>
                <th className="px-4 py-3">Penalty Applied</th>
                <th className="px-4 py-3">Event Type</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const reg = log.competition_attempts?.competition_registrations;
                const name = reg?.teams?.name || reg?.profiles?.full_name || 'Unknown';

                return (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {format(new Date(log.logged_at), 'HH:mm:ss')}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{log.offense_number}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={log.penalty_applied === 'none' ? 'secondary' : 'destructive'}>
                        {log.penalty_applied}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
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
