import type { ReactNode } from "react";

/**
 * Privacy policy — Arabic translation.
 *
 * DRAFT TRANSLATION of ./privacy-en.tsx. It must be reviewed by a lawyer
 * qualified in the UAE before going live. The English version governs: if the
 * two differ, the English text applies (the page says so to the reader and
 * links to /privacy/en).
 *
 * Mirrors the English structure section for section — when the English text
 * changes, update this file in the same change.
 *
 * NOT LEGAL ADVICE.
 *
 * Hook-free so it can render from a server component; the translation notice
 * (which reads the dictionary) is passed in as `notice`.
 */
export function PrivacyPolicyAr({ notice }: { notice?: ReactNode }) {
  return (
    <>
      <h1 className="text-3xl font-bold text-foreground">سياسة الخصوصية</h1>
      <p className="mt-2 text-sm text-muted-foreground">آخر تحديث: 19 أغسطس 2026</p>
      {notice}

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">من نحن</h2>
          <p className="mt-2">
            تقدّم Drsahar Pediatrics استشارات طب الأطفال عبر الإنترنت والتثقيف الصحي. وتوضّح هذه
            السياسة المعلومات التي نجمعها، وأسباب جمعها، والخيارات المتاحة لك. وتسري على موقعنا
            الإلكتروني، ولوحتَي التحكم الخاصتين بأولياء الأمور والأطباء، وأي خدمة تكامل تختار
            تفعيلها.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">المعلومات التي نجمعها</h2>
          <ul className="mt-2 flex list-disc flex-col gap-2 ps-5">
            <li>
              <strong className="text-foreground">بيانات الحساب</strong> — اسمك وعنوان بريدك
              الإلكتروني ورقم هاتفك، لنتمكّن من التعرّف عليك والتواصل معك بشأن الحجوزات.
            </li>
            <li>
              <strong className="text-foreground">الملفات الشخصية للأطفال</strong> — البيانات التي
              تضيفها عن طفلك، وتُستخدم لتقديم الرعاية وتُعرض على الطبيب المعالِج.
            </li>
            <li>
              <strong className="text-foreground">سجلات الاستشارات</strong> — أوقات المواعيد، وسبب
              الزيارة الذي تذكره، والملاحظات السريرية التي يدوّنها طبيبك.
            </li>
            <li>
              <strong className="text-foreground">معلومات الدفع</strong> — تتولى Stripe معالجتها.
              ولا نحتفظ إلا بمرجع للدفع، ولا نخزّن رقم بطاقتك مطلقًا.
            </li>
            <li>
              <strong className="text-foreground">البيانات التقنية</strong> — بيانات السجلات
              الأساسية اللازمة للحفاظ على أمان الخدمة وحسن سيرها.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            بيانات مستخدمي Google وGoogle Calendar
          </h2>
          <p className="mt-2">
            ربط Google Calendar الخاص بك أمر اختياري. وإذا لم تربطه، فستتلقى دعوات التقويم عبر
            البريد الإلكتروني بدلًا من ذلك، ولن نصل إلى حسابك على Google مطلقًا.
          </p>
          <p className="mt-2">وإذا اخترت ربطه، فإننا نطلب من Google ما يلي:</p>
          <ul className="mt-2 flex list-disc flex-col gap-2 ps-5">
            <li>
              <strong className="text-foreground">عنوان بريدك الإلكتروني</strong> (
              <code>openid</code>، <code>email</code>) — وذلك فقط لنُظهر لك حساب Google المرتبط.
            </li>
            <li>
              <strong className="text-foreground">أحداث التقويم</strong> (
              <code>calendar.events</code>) — لإضافة مواعيدك وجلساتك المباشرة في Drsahar
              Pediatrics إلى تقويمك، والحفاظ على دقتها عند إعادة جدولة الحجز أو إلغائه.
            </li>
          </ul>
          <p className="mt-2">
            ولا نُنشئ ولا ندير إلا الأحداث التي نضيفها إلى تقويمك بأنفسنا. ولا نقرأ الأحداث الأخرى
            في تقويمك ولا نحلّلها ولا نصدّرها ولا نخزّنها، ولا نُنشئ أي ملف تعريفي استنادًا إلى
            تقويمك.
          </p>
          <p className="mt-2">
            <strong className="text-foreground">الاستخدام المحدود (Limited Use).</strong> يلتزم
            استخدام Drsahar Pediatrics للمعلومات الواردة من واجهات برمجة تطبيقات Google (Google
            APIs) ونقلها بأحكام{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              سياسة بيانات المستخدمين لخدمات Google API
            </a>
            ، بما في ذلك متطلبات الاستخدام المحدود. ولا نبيع بيانات مستخدمي Google مطلقًا، ولا
            نستخدمها لأغراض إعلانية، ولا نسمح لأي شخص بالاطلاع عليها إلا عند الضرورة لأغراض
            الأمان، أو للامتثال للقانون، أو بموافقتك الصريحة.
          </p>
          <p className="mt-2">
            نحتفظ ببيانات اعتماد الوصول التي تصدرها Google لنتمكّن من تحديث تقويمك باستمرار دون أن
            نطلب منك ذلك مجددًا. وتُحفظ هذه البيانات مشفّرةً أثناء التخزين، ولا تُشارَك مع أي جهة،
            وتُحذف فور إلغاء الربط. ويمكنك إلغاء الربط في أي وقت من صفحة ملفك الشخصي، أو إلغاء صلاحية
            الوصول مباشرةً عبر{" "}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              myaccount.google.com/permissions
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">كيف نستخدم معلوماتك</h2>
          <p className="mt-2">
            نستخدم معلوماتك لتقديم الاستشارات، واستلام الحجوزات والمدفوعات، وإرسال رسائل التأكيد
            والتذكير إليك، والاحتفاظ بالسجلات التي يحتاج إليها طبيبك لعلاج طفلك بأمان، ولتأمين
            الخدمة وتحسينها. ولا نبيع معلوماتك الشخصية، ولا نستخدم المعلومات الصحية لأغراض إعلانية.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">الجهات التي نشاركها معها</h2>
          <p className="mt-2">
            لا نشارك معلوماتك إلا مع مزوّدي الخدمات الذين تعتمد عليهم الخدمة في عملها — Supabase
            (قاعدة البيانات والمصادقة)، وStripe (المدفوعات)، وDaily.co (مكالمات الفيديو)، وResend
            (البريد الإلكتروني)، وGoogle Calendar إذا قمت بربطه. ولا يتلقى كلٌّ منهم إلا ما يحتاج
            إليه. كما نُفصح عن المعلومات متى اقتضى القانون ذلك.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">الاحتفاظ بالبيانات وحذفها</h2>
          <p className="mt-2">
            تُحفظ السجلات الطبية طوال المدة التي تقتضيها لوائح الرعاية الصحية المعمول بها. وتُحفظ
            البيانات الأخرى ما دام حسابك نشطًا. ويمكنك أن تطلب منا حذف حسابك في أي وقت، وسنحذف كل ما
            لا يُلزمنا القانون بالاحتفاظ به. ويؤدي إلغاء ربط Google Calendar إلى حذف بيانات اعتماد
            Google المخزّنة فورًا.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">حقوقك</h2>
          <p className="mt-2">
            يمكنك الاطلاع على معلوماتك أو تصحيحها أو تصديرها أو حذفها، وسحب موافقتك على أي خدمة تكامل
            اختيارية، والاعتراض على أنواع معيّنة من المعالجة. تواصل معنا وسنرد عليك خلال المدة التي
            يسمح بها القانون.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">الأمان</h2>
          <p className="mt-2">
            تُشفَّر البيانات أثناء نقلها وأثناء تخزينها. ويقتصر الوصول إليها على الأشخاص الذين
            يحتاجون إليها لتقديم الرعاية أو دعم الخدمة. وتُجرى استشارات الفيديو في غرف خاصة يتطلب
            الانضمام إليها رمزًا مخصّصًا لكل مشارك.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">خصوصية الأطفال</h2>
          <p className="mt-2">
            الحسابات مخصّصة لأولياء الأمور والأوصياء. ويقدّم وليّ أمر الطفل أو الوصي عليه المعلومات
            المتعلقة بالطفل، وتبقى هذه المعلومات تحت سيطرته.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">التغييرات والتواصل</h2>
          <p className="mt-2">
            إذا طرأ تغيير جوهري على هذه السياسة، فسنعلن عنه هنا، وسنُخطرك به عند الاقتضاء.
            للاستفسارات أو الطلبات: تواصل معنا عبر بيانات الاتصال المتاحة على موقعنا الإلكتروني.
          </p>
        </section>
      </div>
    </>
  );
}
