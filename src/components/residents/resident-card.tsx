import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import type { Resident } from "@/types/database";

export function ResidentCard({ resident }: { resident: Resident }) {
  return (
    <Link href={`/residents/${resident.id}`}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="font-medium">
              {resident.first_name} {resident.last_name}
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {resident.room_number && <span>Room {resident.room_number}</span>}
              {resident.conditions && (
                <span className="truncate max-w-[200px]">
                  {resident.conditions}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={resident.status === "active" ? "default" : "secondary"}
              className="capitalize"
            >
              {resident.status}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
