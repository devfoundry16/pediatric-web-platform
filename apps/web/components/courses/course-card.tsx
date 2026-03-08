"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PlayCircle, BookOpen, Award } from "lucide-react";

interface CourseCardProps {
  course: {
    id: string;
    title: string;
    description: string;
    lessons: number;
    price: number;
    enrolled?: boolean;
    progress?: number;
    thumbnail?: string;
  };
}

export function CourseCard({ course }: CourseCardProps) {
  const { dictionary: t } = useI18n();

  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg">
      <div className="relative aspect-video bg-muted">
        <div className="flex h-full items-center justify-center">
          <PlayCircle className="h-12 w-12 text-muted-foreground/40 transition-colors group-hover:text-primary/60" />
        </div>
        {course.enrolled && (
          <Badge className="absolute start-3 top-3">{t.courses.enrolled}</Badge>
        )}
        {course.price === 0 && (
          <Badge variant="secondary" className="absolute end-3 top-3">
            {t.courses.free}
          </Badge>
        )}
      </div>
      <CardContent className="flex flex-col gap-3 p-5">
        <h3 className="text-base font-semibold text-foreground line-clamp-1">
          {course.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {course.description}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {course.lessons} {t.courses.lessons}
          </span>
          <span className="flex items-center gap-1">
            <Award className="h-3.5 w-3.5" />
            {t.courses.completionCertificate}
          </span>
        </div>

        {course.enrolled && course.progress !== undefined ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t.courses.progress}</span>
              <span className="font-medium text-foreground">{course.progress}%</span>
            </div>
            <Progress value={course.progress} className="h-2" />
            <Button className="mt-1 w-full gap-2" size="sm">
              <PlayCircle className="h-4 w-4" />
              {t.courses.continueLearning}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-foreground">
              {course.price > 0 ? (
                <>
                  {course.price} <span className="text-sm font-normal text-muted-foreground">{t.common.aed}</span>
                </>
              ) : (
                <span className="text-primary">{t.courses.free}</span>
              )}
            </p>
            <Button size="sm">{t.courses.enrollNow}</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
