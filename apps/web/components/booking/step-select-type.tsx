"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Clock } from "lucide-react";

interface StepSelectTypeProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function StepSelectType({ selected, onSelect }: StepSelectTypeProps) {
  const { dictionary: t } = useI18n();

  const types = [
    {
      id: "quick",
      name: t.landing.quick,
      desc: t.landing.quickDesc,
      duration: 15,
      price: 150,
      popular: false,
    },
    {
      id: "standard",
      name: t.landing.standard,
      desc: t.landing.standardDesc,
      duration: 30,
      price: 250,
      popular: true,
    },
    {
      id: "extended",
      name: t.landing.extended,
      desc: t.landing.extendedDesc,
      duration: 45,
      price: 350,
      popular: false,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-foreground">
        {t.booking.selectType}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {types.map((type) => (
          <Card
            key={type.id}
            className={cn(
              "relative cursor-pointer transition-all hover:shadow-md",
              selected === type.id
                ? "border-primary ring-1 ring-primary/20"
                : "border-border"
            )}
            onClick={() => onSelect(type.id)}
          >
            {type.popular && (
              <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                {t.landing.popular}
              </Badge>
            )}
            <CardContent className="flex flex-col items-center gap-3 p-6 pt-8 text-center">
              <p className="font-semibold text-foreground">{type.name}</p>
              <p className="text-xs text-muted-foreground">{type.desc}</p>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {type.duration} {t.common.minutes}
              </div>
              <p className="text-2xl font-bold text-foreground">
                {type.price}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {t.common.aed}
                </span>
              </p>
              {selected === type.id && (
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
