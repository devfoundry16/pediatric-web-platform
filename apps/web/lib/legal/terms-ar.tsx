import type { ReactNode } from "react";

/**
 * Terms of service — Arabic translation.
 *
 * DRAFT TRANSLATION of ./terms-en.tsx. It must be reviewed by a lawyer
 * qualified in the UAE before going live. The English version governs: if the
 * two differ, the English text applies (the page says so to the reader and
 * links to /terms/en).
 *
 * Mirrors the English structure section for section — when the English text
 * changes, update this file in the same change.
 *
 * NOT LEGAL ADVICE.
 *
 * Hook-free so it can render from a server component; the translation notice
 * (which reads the dictionary) is passed in as `notice`.
 */
export function TermsOfServiceAr({ notice }: { notice?: ReactNode }) {
  return (
    <>
      <h1 className="text-3xl font-bold text-foreground">شروط الخدمة</h1>
      <p className="mt-2 text-sm text-muted-foreground">آخر تحديث: 19 أغسطس 2026</p>
      {notice}

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">إخلاء المسؤولية الطبية</h2>
          <p className="mt-2">
            تقدّم Drsahar Pediatrics استشارات طب الأطفال عبر الإنترنت. وهي ليست بديلًا عن رعاية
            الطوارئ.{" "}
            <strong className="text-foreground">
              إذا تعرّض طفلك لحالة طبية طارئة، فاتصل فورًا برقم الطوارئ المحلي أو توجّه إلى أقرب
              قسم للطوارئ.
            </strong>{" "}
            وقد يرى الطبيب أنه لا يمكن تقييم حالة طفلك بأمان عبر الإنترنت، فيطلب منك الحضور
            شخصيًا.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">استخدام الخدمة</h2>
          <p className="mt-2">
            يجب ألا يقل عمرك عن 18 عامًا، وأن تكون وليّ الأمر أو الوصي القانوني لأي طفل تحجز له.
            وتوافق على تقديم معلومات دقيقة — إذ تعتمد عليها القرارات السريرية — وعلى الحفاظ على
            سرية بيانات تسجيل الدخول الخاصة بك. والحسابات شخصية ولا يجوز مشاركتها.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">الحجوزات والمدفوعات والإلغاء</h2>
          <p className="mt-2">
            تُعرض الأسعار قبل تأكيدك للحجز، وتُحصَّل بالدرهم الإماراتي عبر مزوّد خدمة الدفع لدينا.
            وتسري باقات الاستشارات طوال المدة المحددة عند الشراء. ويمكنك إعادة جدولة الحجز أو
            إلغاؤه من لوحة التحكم الخاصة بك، ويخضع استرداد المبالغ للسياسة المعروضة وقت الحجز.
            ويجوز لنا إلغاء الحجز ورد المبلغ إذا أصبح الطبيب غير متاح.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">استشارات الفيديو</h2>
          <p className="mt-2">
            تُجرى الاستشارات في غرفة فيديو خاصة تنضم إليها من لوحة التحكم الخاصة بك. وتحتاج إلى
            اتصال مستقر بالإنترنت، وكاميرا وميكروفون يعملان بشكل سليم. يُرجى عدم تسجيل أي استشارة دون
            موافقة جميع المشاركين فيها.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">خدمات التكامل الاختيارية</h2>
          <p className="mt-2">
            يمكنك ربط Google Calendar لتظهر حجوزاتك فيه تلقائيًا. وهذا الربط اختياري، ويمكن إلغاؤه
            في أي وقت، ويخضع لسياسة الخصوصية الخاصة بنا.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">الاستخدام المقبول</h2>
          <p className="mt-2">
            يُحظر إساءة استخدام الخدمة: فلا يجوز استخدامها لأغراض غير مشروعة، ولا محاولة الوصول إلى
            بيانات الآخرين، ولا التدخل في عمل المنصة، ولا الإساءة إلى موظفينا أو أطبائنا. ويجوز لنا
            تعليق الحسابات التي تخالف هذه الشروط.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">توفّر الخدمة والمسؤولية</h2>
          <p className="mt-2">
            نسعى إلى إبقاء الخدمة متاحة، لكن لا يمكننا ضمان الوصول إليها دون انقطاع، ولا نتحمّل
            المسؤولية عن أي أعطال في جهازك أو اتصالك. وليس في هذه الشروط ما يحدّ من المسؤولية التي
            لا يجوز الحدّ منها قانونًا، بما في ذلك المسؤولية عن الوفاة أو الإصابة الشخصية الناجمة
            عن الإهمال.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">التغييرات والتواصل</h2>
          <p className="mt-2">
            يجوز لنا تحديث هذه الشروط، وسننشر أي تغييرات جوهرية هنا. ويُعدّ استمرارك في استخدام
            الخدمة بعد أي تغيير قبولًا منك له. للاستفسارات: تواصل معنا عبر بيانات الاتصال المتاحة
            على موقعنا الإلكتروني.
          </p>
        </section>
      </div>
    </>
  );
}
