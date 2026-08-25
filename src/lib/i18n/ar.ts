/**
 * Centralised Arabic copy (default language). English is supported
 * architecturally but Arabic is the default and the UI is true-RTL.
 *
 * IMPORTANT: legal copy (privacy/terms/benefit rules) is NOT stored here as
 * final text — it must come from approved sources and is marked
 * REQUIRES_APPROVED_LEGAL_COPY until provided (prompt §54, §56).
 */
export const AR = {
  brand: {
    fanhour: 'فان أور',
    hazem: 'الحزم',
    cross: '×',
  },
  fixture: {
    predictCta: 'سجّل توقعك',
    whoWins: 'من يفوز؟',
    hazem: 'الحزم',
    draw: 'تعادل',
    predictionsClosed: 'أُغلق التوقع لهذه المباراة',
    predictionsNotOpen: 'لم يُفتح التوقع بعد',
    kickoff: 'موعد المباراة',
    noActiveFixture: 'لا توجد مباراة نشطة حاليًا',
    noActiveFixtureBody: 'تابعنا قبل مباراة الحزم القادمة لتسجيل توقعك.',
    competition: 'البطولة',
    venueHome: 'أرضنا',
    venueAway: 'خارج الأرض',
  },
  prediction: {
    chose: (choice: string) => `اخترت ${choice} ✓`,
    canChangeUntilCutoff: 'يمكنك تعديل توقعك حتى إغلاق التوقعات.',
    submitError: 'تعذّر تسجيل التوقع. حاول مرة أخرى.',
    optionalDepthTitle: 'توقّع النتيجة بالتحديد (اختياري)',
    optionalDepthHint: 'اختياري تمامًا — لا يؤثر على مشاركتك أو أي منفعة.',
    saveScore: 'حفظ النتيجة المتوقعة',
  },
  community: {
    tooEarly: 'التوقعات ما زالت في بدايتها لهذه المباراة.',
    hazemPct: (p: number) => `${p}٪ من المشاركين يتوقعون فوز الحزم`,
    heading: 'ماذا يتوقع الجمهور؟',
  },
  result: {
    heading: 'نتيجة المباراة',
    yourPrediction: 'توقعك',
    correct: 'توقعك جاء صحيحًا',
    incorrect: 'توقعك لم يتحقق هذه المرة',
    finalScore: 'النتيجة النهائية',
    nextFixture: 'المباراة القادمة',
    seeRecord: 'سجلي مع الحزم',
  },
  record: {
    heading: 'سجلي مع الحزم',
    subtitle: 'سجل مشاركتك ودقّة توقعاتك مع الحزم',
    fixturesParticipated: 'مباريات شاركت فيها',
    correctPredictions: 'توقعات صحيحة',
    accuracy: 'دقة التوقع',
    recentParticipation: (n: number, m: number) => `شاركت في ${n} من آخر ${m} مباريات`,
    firstParticipation: 'أول مشاركة',
    empty: 'لم تسجّل أي توقع بعد. ابدأ من مباراة الحزم القادمة.',
  },
  benefit: {
    heading: 'منفعة جمهور الحزم',
    fromPartner: 'ميزة من الشريك',
    claim: 'احصل على الميزة',
    terms: 'شروط الميزة',
    validity: 'صالحة حتى',
    consentBenefit: 'أوافق على شروط المنفعة وسياسة الخصوصية.',
    consentMarketing: 'أوافق على استقبال رسائل عن مباريات الحزم ومزايا الشركاء.',
    notEligible: 'هذه الميزة مرتبطة بالمشاركة في هذه المباراة تحديدًا.',
    unavailable: 'الميزة غير متاحة حاليًا.',
    yourCode: 'رمز الاستلام',
    showToMerchant: 'اعرض هذا الرمز لدى الشريك عند الاستلام.',
    needHelp: 'أحتاج مساعدة',
  },
  otp: {
    phoneLabel: 'رقم الجوال',
    phonePlaceholder: '05XXXXXXXX',
    sendCode: 'إرسال رمز التحقق',
    codeLabel: 'رمز التحقق',
    verify: 'تأكيد',
    whyPhone: 'نطلب رقم جوالك للتحقق قبل استلام الميزة فقط.',
    invalidPhone: 'رقم جوال غير صحيح.',
    invalidCode: 'رمز غير صحيح.',
    expired: 'انتهت صلاحية الرمز. أعد الإرسال.',
    tooMany: 'محاولات كثيرة. حاول لاحقًا.',
    resend: 'إعادة الإرسال',
  },
  privacy: {
    beforePhone: 'لا نطلب منك اسمًا أو رقم جوال لتسجيل توقعك.',
  },
  common: {
    loading: 'جارٍ التحميل…',
    error: 'حدث خطأ. حاول مرة أخرى.',
    back: 'رجوع',
    share: 'مشاركة',
    testBadge: 'بيانات تجريبية',
  },
} as const;
