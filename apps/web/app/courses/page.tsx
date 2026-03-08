"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CourseCard } from "@/components/courses/course-card";

const mockCourses = [
  {
    id: "1",
    title: "Child Nutrition Essentials",
    description: "Learn the fundamentals of child nutrition from birth to age 5. Covers breastfeeding, solid foods, and balanced diets.",
    lessons: 12,
    price: 199,
    enrolled: false,
  },
  {
    id: "2",
    title: "Managing Common Childhood Illnesses",
    description: "A comprehensive guide to identifying and managing fevers, colds, stomach bugs, and other common childhood illnesses.",
    lessons: 8,
    price: 149,
    enrolled: true,
    progress: 62,
  },
  {
    id: "3",
    title: "Vaccination Guide for Parents",
    description: "Everything you need to know about the UAE vaccination schedule, side effects, and how to prepare your child.",
    lessons: 6,
    price: 0,
    enrolled: false,
  },
  {
    id: "4",
    title: "Newborn Care 101",
    description: "Essential care tips for the first 3 months: feeding, sleeping, bathing, and recognizing warning signs.",
    lessons: 10,
    price: 179,
    enrolled: true,
    progress: 25,
  },
  {
    id: "5",
    title: "Child Development Milestones",
    description: "Track and understand your child's physical, cognitive, and emotional development milestones from 0-5 years.",
    lessons: 15,
    price: 249,
    enrolled: false,
  },
  {
    id: "6",
    title: "First Aid for Parents",
    description: "Learn essential first aid techniques for common childhood injuries and emergencies. Be prepared when it matters.",
    lessons: 9,
    price: 129,
    enrolled: false,
  },
];

export default function CoursesPage() {
  const { dictionary: t } = useI18n();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t.courses.title}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {t.courses.subtitle}
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {mockCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
