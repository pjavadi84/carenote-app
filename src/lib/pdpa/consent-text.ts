/**
 * PDPA consent text — provisional v0.
 *
 * This file holds the EXACT consent copy presented to residents (or their
 * personal representatives) before this organization may process their
 * personal health data via Kinroster.
 *
 * STATUS: PROVISIONAL — NOT ATTORNEY-REVIEWED.
 *
 * The May 2026 Taiwan due-diligence brief explicitly states that consent
 * copy in this domain "should be drafted by a qualified Taiwan-licensed
 * attorney and a certified medical translator — do not rely on LLM
 * translation for consent documents." This v0 string is a structural
 * placeholder that hits the elements PDPA requires (data controller,
 * purpose, categories, sub-processors, international transfer disclosure,
 * retention, data-subject rights, withdrawal mechanism, DPO contact) so
 * the engineering scaffold is exercised end-to-end. Replace with
 * attorney-approved copy before relying on these consents in any
 * regulatory defense.
 *
 * Versioning: every consent record stores both `consent_text_version` and
 * `consent_text_snapshot` (the exact rendered string). When attorney copy
 * lands, ATTORNEY_REVIEWED flips to true and CONSENT_TEXT_VERSION bumps;
 * existing v0 consents remain valid records of what was captured but ops
 * can identify them and re-capture if legal advises.
 */

export const CONSENT_TEXT_VERSION = "v0-provisional-2026-05";
export const ATTORNEY_REVIEWED = false;

export interface ConsentTextParams {
  /** Organization legal name as it should appear in the consent. */
  orgName: string;
  /** Email for data-subject requests / DPO contact. */
  dpoEmail: string;
  /** Resident first name (or full name) — interpolated into the consent. */
  residentName: string;
}

/** Family contact (the family member) consenting on their own behalf. */
export interface FamilyContactConsentTextParams {
  orgName: string;
  dpoEmail: string;
  contactName: string;
  /** The resident their updates relate to. */
  residentName: string;
}

/**
 * Caregiver self-acknowledgment OR admin-attested paper consent.
 *
 * IMPORTANT: this consent text is provided ONLY in zh-TW + en. The Taiwan
 * elder-care workforce is heavily Indonesian / Vietnamese / Filipino
 * migrant care workers; their primary language is rarely zh-TW. The May
 * 2026 due-diligence brief explicitly bans LLM translation of consent
 * documents — id / vi / tl copy must come from a certified medical
 * translator engaged alongside a Taiwan-licensed attorney.
 *
 * Until that drop-in is available, the operational pattern is:
 *
 *   - Caregivers who CAN read en / zh-TW may self-acknowledge in the app.
 *   - All other caregivers sign paper consent in their native language
 *     (org's responsibility under Taiwan labor law); an admin records
 *     the standing consent in the system as an audit anchor pointing to
 *     the paper version.
 *
 * Both flows write to the existing consent_records table with distinct
 * consent_type values (see api/pdpa/caregiver-consents).
 */
export interface CaregiverConsentTextParams {
  orgName: string;
  dpoEmail: string;
  caregiverName: string;
}

export type ConsentLocale = "zh-TW" | "en";

/**
 * Render the provisional consent text in the requested locale. Returns
 * the exact string that should be displayed to the consenting party AND
 * stored verbatim in `consent_text_snapshot` on the resulting consent
 * record.
 */
export function renderConsentText(
  params: ConsentTextParams,
  locale: ConsentLocale
): string {
  if (locale === "zh-TW") {
    return renderZhTw(params);
  }
  return renderEn(params);
}

export function renderFamilyContactConsentText(
  params: FamilyContactConsentTextParams,
  locale: ConsentLocale
): string {
  return locale === "zh-TW"
    ? renderFamilyContactZhTw(params)
    : renderFamilyContactEn(params);
}

export function renderCaregiverConsentText(
  params: CaregiverConsentTextParams,
  locale: ConsentLocale
): string {
  return locale === "zh-TW"
    ? renderCaregiverZhTw(params)
    : renderCaregiverEn(params);
}

function renderZhTw({
  orgName,
  dpoEmail,
  residentName,
}: ConsentTextParams): string {
  return `【個人資料處理同意書（暫行版本 ${CONSENT_TEXT_VERSION}）】

本同意書尚未經律師審閱，為系統測試用途之暫行版本。
正式版本將由台灣執業律師審閱後提供。

一、資料控制者
本機構：${orgName}

二、資料當事人
${residentName}（以下稱「住民」）

三、蒐集目的
為提供住民之照護紀錄、家屬通訊、臨床交班與相關照護服務之必要使用。

四、蒐集之個人資料類別
姓名、出生年月日、身分證字號、聯絡資訊、健康狀況、照護觀察紀錄、
語音與書面紀錄。

五、處理與利用之期間、地區、對象及方式
（一）期間：自同意之日起至住民終止照護服務或撤回同意之日止，
另依法定保存期限留存最多五年。
（二）地區：含中華民國境內，以及下列雲端服務供應商所在之國家
（含美國）。本機構將進行跨境傳輸個人資料以支援照護紀錄之
人工智慧協助處理。
（三）對象：本機構之照護人員與管理人員，以及下列必要之資料
處理者（共同處理者）：
   - Anthropic, PBC（Claude 人工智慧服務，美國）
   - OpenAI, L.L.C.（Whisper 語音轉錄服務，美國）
   - Resend, Inc.（電子郵件遞送服務，美國）
   - Supabase Inc.（資料庫與身分認證服務，新加坡／美國）
   - Vercel Inc.（網站基礎建設服務，美國）
（四）方式：以電子方式蒐集、儲存、處理及利用，並透過上述
服務供應商之 API 進行必要之自動化處理。

六、住民得行使之權利
依個人資料保護法第三條，住民得就本機構所保有之個人資料，
請求下列事項：
   1. 查詢或請求閱覽
   2. 請求製給複製本
   3. 請求補充或更正
   4. 請求停止蒐集、處理或利用
   5. 請求刪除
住民亦得隨時撤回本同意書之全部或部分同意。撤回同意不影響
撤回前依本同意書所為之資料處理。

七、撤回同意之方式
請以電子郵件通知本機構資料保護聯絡人：${dpoEmail}
本機構將於收到通知後依法停止相關之資料處理。

八、不提供個人資料之影響
若住民或其法定代理人不提供本同意書所列之個人資料，本機構將
無法提供完整之照護紀錄與家屬通訊服務。

九、生效
本同意書自簽署之日起生效。

—

本人已詳讀並了解上述內容，同意 ${orgName} 依本同意書所載之
範圍、方式及目的處理 ${residentName} 之個人資料。`;
}

function renderEn({
  orgName,
  dpoEmail,
  residentName,
}: ConsentTextParams): string {
  return `[Personal Data Processing Consent — Provisional ${CONSENT_TEXT_VERSION}]

This consent has not yet been reviewed by a licensed attorney. It is a
provisional version for system testing. The final version will be
provided after review by a Taiwan-licensed attorney.

1. Data Controller
${orgName} ("the Organization")

2. Data Subject
${residentName} ("the Resident")

3. Purpose
To provide care records, family communications, clinical handoff, and
related care services for the Resident.

4. Categories of Personal Data Collected
Name, date of birth, government ID, contact information, health status,
caregiver observations, voice and written records.

5. Period, Region, Recipients, and Method
(a) Period: From the date of consent until the Resident's care services
end or consent is withdrawn, with statutory retention up to 5 years.
(b) Region: Republic of China (Taiwan) territory, plus the countries in
which the cloud service providers listed below operate (including the
United States). The Organization will engage in cross-border transfer of
personal data to support AI-assisted processing of care records.
(c) Recipients: The Organization's caregivers and administrators, and
the following necessary data processors (joint controllers):
   - Anthropic, PBC (Claude AI services, USA)
   - OpenAI, L.L.C. (Whisper voice transcription, USA)
   - Resend, Inc. (email delivery, USA)
   - Supabase Inc. (database and authentication, Singapore / USA)
   - Vercel Inc. (web infrastructure, USA)
(d) Method: Electronic collection, storage, processing, and use, with
necessary automated processing via the above providers' APIs.

6. Rights of the Data Subject
Pursuant to Article 3 of the Personal Data Protection Act, the Resident
may request:
   1. Inquiry or access
   2. Copies
   3. Supplementation or correction
   4. Cessation of collection, processing, or use
   5. Deletion
The Resident may also withdraw all or part of this consent at any time.
Withdrawal does not affect processing performed before withdrawal.

7. How to Withdraw
Please email the Organization's data protection contact: ${dpoEmail}
The Organization will cease relevant processing as required by law upon
receipt of notice.

8. Effect of Refusing to Provide Data
If the Resident or their legal representative does not provide the data
listed in this consent, the Organization cannot provide full care
records or family communication services.

9. Effective Date
This consent is effective from the date of signature.

—

I have read and understood the above and consent to ${orgName}
processing ${residentName}'s personal data within the scope, methods,
and purposes set out in this consent.`;
}

function renderFamilyContactZhTw({
  orgName,
  dpoEmail,
  contactName,
  residentName,
}: FamilyContactConsentTextParams): string {
  return `【家屬聯絡人個人資料處理同意書（暫行版本 ${CONSENT_TEXT_VERSION}）】

本同意書尚未經律師審閱，為系統測試用途之暫行版本。
正式版本將由台灣執業律師審閱後提供。

一、資料控制者
本機構：${orgName}

二、資料當事人
${contactName}（以下稱「聯絡人」），${residentName}（以下稱「住民」）之家屬聯絡人。

三、蒐集目的
為向聯絡人提供與住民相關之照護更新、家屬通訊及必要之聯繫服務。

四、蒐集之個人資料類別
姓名、與住民之關係、電子郵件地址、電話、聯繫偏好、收件記錄。

五、處理與利用之期間、地區、對象及方式
（一）期間：自同意之日起至聯絡人撤回同意或住民終止照護服務之日止。
（二）地區：含中華民國境內，以及下列雲端服務供應商所在之國家
（含美國）。
（三）對象：本機構之照護人員與管理人員，以及下列必要之資料
處理者：
   - Anthropic, PBC（Claude 人工智慧服務，美國）
   - Resend, Inc.（電子郵件遞送服務，美國）
   - Supabase Inc.（資料庫服務，新加坡／美國）
   - Vercel Inc.（網站基礎建設服務，美國）
（四）方式：以電子方式蒐集、儲存、處理及利用，並以電子郵件
方式遞送 AI 協助撰寫之家屬通訊。

六、聯絡人得行使之權利
依個人資料保護法第三條，聯絡人得就本機構所保有之個人資料，
請求查詢、閱覽、更正、停止處理或刪除。聯絡人亦得隨時撤回
本同意書之全部或部分同意。

七、撤回同意之方式
請以電子郵件通知本機構資料保護聯絡人：${dpoEmail}

八、不提供個人資料之影響
若聯絡人不提供本同意書所列之資料，本機構將無法提供住民相關
之家屬通訊服務。

九、生效
本同意書自簽署之日起生效。

—

本人 ${contactName} 已詳讀並了解上述內容，同意 ${orgName}
依本同意書所載之範圍、方式及目的處理本人之個人資料，並接收
與 ${residentName} 相關之照護通訊。`;
}

function renderFamilyContactEn({
  orgName,
  dpoEmail,
  contactName,
  residentName,
}: FamilyContactConsentTextParams): string {
  return `[Family Contact Personal Data Processing Consent — Provisional ${CONSENT_TEXT_VERSION}]

This consent has not yet been reviewed by a licensed attorney. It is a
provisional version for system testing.

1. Data Controller
${orgName} ("the Organization")

2. Data Subject
${contactName} ("the Contact"), family contact for ${residentName}
("the Resident").

3. Purpose
To provide the Contact with care updates, family communications, and
necessary correspondence relating to the Resident.

4. Categories of Personal Data Collected
Name, relationship to the Resident, email address, phone number,
communication preferences, delivery records.

5. Period, Region, Recipients, and Method
(a) Period: From the date of consent until the Contact withdraws
consent or the Resident's care ends.
(b) Region: Republic of China (Taiwan), plus the cloud service
providers' countries (including the United States).
(c) Recipients: The Organization and the following necessary data
processors:
   - Anthropic, PBC (Claude AI services, USA)
   - Resend, Inc. (email delivery, USA)
   - Supabase Inc. (database, Singapore / USA)
   - Vercel Inc. (web infrastructure, USA)
(d) Method: Electronic collection, storage, processing, and email
delivery of AI-assisted family communications.

6. Rights of the Contact
Pursuant to Article 3 of the Personal Data Protection Act, the Contact
may request inquiry, copies, correction, cessation of processing, or
deletion. The Contact may also withdraw all or part of this consent at
any time.

7. How to Withdraw
Please email the Organization's data protection contact: ${dpoEmail}

8. Effect of Refusing to Provide Data
If the Contact does not provide the data listed, the Organization
cannot provide family communication services for the Resident.

9. Effective Date
This consent is effective from the date of signature.

—

I, ${contactName}, have read and understood the above and consent to
${orgName} processing my personal data within the scope, methods, and
purposes set out in this consent, and to receiving care communications
relating to ${residentName}.`;
}

function renderCaregiverZhTw({
  orgName,
  dpoEmail,
  caregiverName,
}: CaregiverConsentTextParams): string {
  return `【照護人員個人資料處理同意書（暫行版本 ${CONSENT_TEXT_VERSION}）】

本同意書尚未經律師審閱，且尚未提供印尼文（id）、越南文（vi）
或他加祿語（tl）譯本。母語非中文之照護人員應以紙本方式簽署
其母語版本之同意書，由本機構管理人員代為登記於系統中。

一、資料控制者
本機構：${orgName}

二、資料當事人
${caregiverName}（以下稱「本人」）

三、蒐集目的
為支援本機構照護紀錄之撰寫、語音轉錄及人工智慧協助處理。

四、蒐集之個人資料類別
姓名、員工識別資料、語音錄音之轉錄文字（語音檔本身不留存）、
書面照護紀錄、登入記錄。

五、處理與利用之期間、地區、對象及方式
（一）期間：自同意之日起至本人離職或撤回同意之日止，依法
保存最多五年。
（二）地區：含中華民國境內，以及下列雲端服務供應商所在之
國家（含美國）。
（三）對象：本機構之管理人員，以及下列必要之資料處理者：
   - Anthropic, PBC（Claude 人工智慧服務，美國）
   - OpenAI, L.L.C.（Whisper 語音轉錄服務，美國）
   - Supabase Inc.（資料庫服務，新加坡／美國）
   - Vercel Inc.（網站基礎建設服務，美國）
（四）方式：以電子方式蒐集、轉錄、儲存、處理及利用。
語音原始檔案不留存，僅保留轉錄後之文字。

六、本人得行使之權利
依個人資料保護法第三條，本人得就本機構所保有之個人資料，
請求查詢、閱覽、更正、停止處理或刪除。本人亦得隨時撤回
本同意書。

七、撤回同意之方式
請以電子郵件通知本機構資料保護聯絡人：${dpoEmail}
亦可向本機構主管以書面方式提出。

八、生效
本同意書自簽署之日起生效。

—

本人 ${caregiverName} 已詳讀並了解上述內容，同意 ${orgName}
依本同意書所載之範圍、方式及目的處理本人之個人資料。`;
}

function renderCaregiverEn({
  orgName,
  dpoEmail,
  caregiverName,
}: CaregiverConsentTextParams): string {
  return `[Caregiver Personal Data Processing Consent — Provisional ${CONSENT_TEXT_VERSION}]

This consent has not yet been reviewed by a licensed attorney, and
Indonesian (id), Vietnamese (vi), and Tagalog (tl) translations are
not yet available. Caregivers whose primary language is not English
or Mandarin should sign a paper consent in their native language;
an organization administrator will record that paper consent in the
system as an audit anchor.

1. Data Controller
${orgName} ("the Organization")

2. Data Subject
${caregiverName} ("I" / "me")

3. Purpose
To support care record authoring, voice transcription, and AI-assisted
processing of caregiver observations.

4. Categories of Personal Data Collected
Name, employee identification, transcripts of voice recordings (audio
files are not retained), written care records, login logs.

5. Period, Region, Recipients, and Method
(a) Period: From the date of consent until termination of employment
or withdrawal of consent, with statutory retention up to 5 years.
(b) Region: Republic of China (Taiwan), plus the cloud service
providers' countries (including the United States).
(c) Recipients: The Organization's administrators and the following
necessary data processors:
   - Anthropic, PBC (Claude AI services, USA)
   - OpenAI, L.L.C. (Whisper voice transcription, USA)
   - Supabase Inc. (database, Singapore / USA)
   - Vercel Inc. (web infrastructure, USA)
(d) Method: Electronic collection, transcription, storage, processing,
and use. Original audio files are not retained — only the transcribed
text.

6. My Rights
Pursuant to Article 3 of the Personal Data Protection Act, I may
request inquiry, copies, correction, cessation of processing, or
deletion. I may also withdraw this consent at any time.

7. How to Withdraw
Please email the Organization's data protection contact: ${dpoEmail}
Or notify your supervisor in writing.

8. Effective Date
This consent is effective from the date of signature.

—

I, ${caregiverName}, have read and understood the above and consent
to ${orgName} processing my personal data within the scope, methods,
and purposes set out in this consent.`;
}
