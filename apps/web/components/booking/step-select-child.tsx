"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const mockChildren = [
  { id: "1", name: "Ahmed Al-Rashid", age: "4 years", initials: "AR" },
  { id: "2", name: "Layla Al-Rashid", age: "2 years", initials: "LR" },
];

interface StepSelectChildProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function StepSelectChild({ selected, onSelect }: StepSelectChildProps) {
  const { dictionary: t } = useI18n();

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        {t.booking.selectChild}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {mockChildren.map((child) => (
          <Card
            key={child.id}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              selected === child.id
                ? "border-primary ring-1 ring-primary/20"
                : "border-border"
            )}
            onClick={() => onSelect(child.id)}
          >
            <CardContent className="flex items-center gap-4 p-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {child.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium text-foreground">{child.name}</p>
                <p className="text-sm text-muted-foreground">{child.age}</p>
              </div>
              {selected === child.id && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
