"use client";

import { useI18n } from "@/lib/i18n/i18n-context";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SessionCard } from "@/components/live-sessions/session-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const mockUpcomingSessions = [
  {
    id: "1",
    title: "Child Nutrition Workshop",
    description: "Learn about balanced diets and healthy eating habits for children aged 1-5. Interactive Q&A included.",
    date: "Feb 20, 2026",
    time: "7:00 PM",
    duration: 60,
    maxUsers: 30,
    currentUsers: 22,
    price: 50,
  },
  {
    id: "2",
    title: "Fever Management for Parents",
    description: "Understanding when to worry about fevers, home remedies, and when to seek emergency care.",
    date: "Feb 25, 2026",
    time: "6:00 PM",
    duration: 45,
    maxUsers: 25,
    currentUsers: 25,
    price: 0,
  },
  {
    id: "3",
    title: "Vaccination Guidance Session",
    description: "Complete walkthrough of the UAE vaccination schedule with tips to prepare your child and manage side effects.",
    date: "Mar 3, 2026",
    time: "7:30 PM",
    duration: 60,
    maxUsers: 40,
    currentUsers: 15,
    price: 0,
  },
];

const mockPastSessions = [
  {
    id: "4",
    title: "Sleep Training Basics",
    description: "Evidence-based approaches to help your baby sleep through the night.",
    date: "Jan 28, 2026",
    time: "7:00 PM",
    duration: 60,
    maxUsers: 30,
    currentUsers: 30,
    price: 50,
    isPast: true,
    hasRecording: true,
  },
  {
    id: "5",
    title: "Breastfeeding Support Group",
    description: "Open discussion and expert guidance on common breastfeeding challenges.",
    date: "Jan 15, 2026",
    time: "6:00 PM",
    duration: 45,
    maxUsers: 20,
    currentUsers: 18,
    price: 0,
    isPast: true,
    hasRecording: true,
  },
];

export default function LiveSessionsPage() {
  const { dictionary: t } = useI18n();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t.liveSessions.title}
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              {t.liveSessions.subtitle}
            </p>
          </div>

          <Tabs defaultValue="upcoming" className="mt-10">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="upcoming">
                {t.liveSessions.upcoming}
              </TabsTrigger>
              <TabsTrigger value="past">{t.liveSessions.past}</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="mt-6 flex flex-col gap-4">
              {mockUpcomingSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </TabsContent>
            <TabsContent value="past" className="mt-6 flex flex-col gap-4">
              {mockPastSessions.map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
