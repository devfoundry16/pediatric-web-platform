"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, ChevronRight } from "lucide-react";

const mockChildren = [
  {
    id: "1",
    name: "Ahmed Al-Rashid",
    age: "4 years",
    gender: "Male",
    initials: "AR",
  },
  {
    id: "2",
    name: "Layla Al-Rashid",
    age: "2 years",
    gender: "Female",
    initials: "LR",
  },
];

export function ChildrenList() {
  const { dictionary: t } = useI18n();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          {t.parentDashboard.myChildren}
        </CardTitle>
        <Link href="/dashboard/parent/children/add">
          <Button size="sm" variant="outline" className="gap-1.5 bg-transparent">
            <Plus className="h-3.5 w-3.5" />
            {t.parentDashboard.addChild}
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {mockChildren.map((child) => (
          <Link
            key={child.id}
            href={`/dashboard/parent/children/${child.id}`}
            className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary">
                  {child.initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {child.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {child.age} &middot; {child.gender}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
