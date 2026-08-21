# دليل العرض التوضيحي — FanHour × Al Hazem
# Demo Runbook

الرسالة الأساسية: **التفاعل موجود — لكن كيف يتحول إلى قيمة؟**

The demo opens from the audience, not from the company. The room plays first;
the value board fills while they play. Nothing on screen is simulated during the
demo — every number moves because someone in the room actually did something.

---

## 1. Setup (5 minutes before)

```bash
npm install
rm -rf data
npm run seed          # fixtures + open F1 challenge + demo sponsor/offer
npm run demo          # prior engagement, so the board opens on a real base
npm run build
FH_DEMO=1 PORT=8787 npm start
```

Open three things:

| Screen | URL | Who holds it |
|---|---|---|
| **Value board** | `/board?k=dev-board-key` | projector |
| **Fan journey** | `/` | presenter's phone (screen-recorded) |
| **Merchant validator** | `/merchant` | second phone or laptop |

Merchant login: `staff_demo` / PIN `1234`.

Set `FH_BOARD_KEY` and `FH_ADMIN_KEY` to real values before showing this
anywhere public.

> `FH_DEMO=1` displays the OTP on the fan's screen so the journey can be filmed
> without a live SMS route. It is visibly badged as a demo scaffold, and
> `/api/admin/launch-readiness` returns **FAIL** while it is set.

To re-run the demo from a clean board:

```bash
curl -X POST -H "x-fh-admin-key: $FH_ADMIN_KEY" localhost:8787/api/admin/demo/reset
npm run demo
```

---

## 2. The one journey, start to finish

Runs in about 90 seconds. One fan, one fixture, one benefit.

### 01 — المشجع: ماذا يرى؟

Audience scans the QR on the board. It opens `/?src=board`.

They land on **تحدي الحزم — الأهلي**: the club and the fixture lead, the
sponsor benefit is one quiet line at the bottom. No login, no app install, no
phone number.

> Say: *"لا يوجد تسجيل. لا يوجد تطبيق. المشجّع يفتح الرابط ويلعب."*

### 02 — التفاعل: ماذا يفعل؟

Three questions about Al Hazem. Progress reads 1/3, 2/3, 3/3.

Then the result: score, accuracy, a short positive line, and an explanation of
every answer. Optionally open **ترتيب هذه الجولة** — a matchweek board that is
explicitly labelled as unrelated to any prize.

**Point at the projector here.** `مشجّع أكمل التحدي` has just gone up.

> Say: *"هذا هو التفاعل. حتى الآن، هذا ما تراه أي جهة رياضية اليوم — رقم."*

### 03 — القيمة: كيف يتحول؟

Continue to the sponsor benefit. Say the line that does the work:

> *"المزية لا تعتمد على النتيجة. من أكمل التحدي يستحقها — سواء أجاب صح أو خطأ."*

Tap **أريد الحصول على المزية**. Now — and only now — the app asks for
سنة الميلاد، منطقة السكن، رقم الجوال. Four fields. No GPS, no address.

> Say: *"لاحظوا التسلسل. لم نطلب أي بيانات قبل أن نقدّم قيمة."*

Enter the OTP shown on screen. A single-use QR and short code appear.

**Point at the projector again.** `مشجّع موثّق` and `مزية صدرت` both moved.

### 04 — الإغلاق: القيمة الحقيقية

Hand the phone to whoever is holding the merchant screen. They type the short
code → **صالحة** → **أكّد الاستخدام**.

**Third look at the projector.** `استخدام مؤكد لدى التاجر` has gone up.

Present the same code a second time. It returns **مستخدمة سابقًا**.

> Say: *"هذه هي النقطة. لم نعد نقيس إعجابات — نقيس مشجّعًا حقيقيًا من الرس،
> دخل محلًا حقيقيًا، واستخدم مزية تم التحقق منها."*

---

## 3. The problem statement (before the demo)

> جهة رياضية لديها جمهور متفاعل — منشورات، تعليقات، متابعون.
> لكن عندما يسأل التاجر المحلي: *"كم شخصًا من الرس دخل محلي بسبب النادي؟"*
> لا توجد إجابة.
>
> التفاعل يُقاس بالإعجابات. القيمة تُقاس بالزيارات.
> ولا أحد يربط بين الاثنين.

The board's middle column is that gap, on screen, the whole time.

---

## 4. What the board shows

| Left panel — القيمة | Right panel — التفاعل موجود |
|---|---|
| استخدام مؤكد لدى التاجر | مشجّع أكمل التحدي |
| مشجّع موثّق · مزية صدرت | بدأوا التحدي · إجابة مُسجّلة |
| من الرس والقصيم + التوزيع الجغرافي | نسبة الإكمال |

Every figure is aggregate. No fan is identifiable from this screen — which is
what makes it safe to put on a wall in front of an audience, and it is worth
saying out loud.

---

## 5. If something goes wrong

| Problem | Fix |
|---|---|
| Board shows `مفتاح العرض غير صحيح` | `k=` must match `FH_BOARD_KEY` |
| Board stuck at zero | `npm run demo` was not run, or reset wiped it |
| No open challenge on the landing page | `rm -rf data && npm run seed` |
| OTP box not shown on the fan screen | server not started with `FH_DEMO=1` |
| Merchant says `هذه المزية لا تخص هذا الفرع` | logged in as the wrong outlet's staff |
| Codes stop validating after restart | merchant sessions are in memory — log in again |

---

## 6. Boundaries — say these if asked

Worth stating plainly rather than being caught by them:

- **The board is not a club product.** The pilot spec forbids club and sponsor
  self-serve dashboards. This is a FanHour-operated presentation surface,
  key-gated, aggregate-only. Contracted sponsor reporting stays manual.
- **Sponsor, offer and outlet in the demo are illustrative**, not signed deals.
- **No push notifications exist.** The return cue is the football calendar plus
  club-owned distribution, and an optional consented reminder. Daily streaks and
  push loops are deliberately out of scope.
- **No comments or open voting.** The Day-0 interaction is the three-question
  challenge and the merchant benefit. Anything social carries moderation and
  legal exposure the pilot has not cleared.
- **Numbers on the board are pilot demo data**, not results. Real figures start
  at F1 on the live fixture.
