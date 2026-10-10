import type {
  ApiResponse,
  HealthCheckResponse,
  OtpSendPayload,
  OtpSendResponse,
  OtpVerifyPayload,
  OtpVerifyResponse,
  PartnerOnboardingPayload,
  OutletOption,
  PartnerOnboardingResponse,
  PartnerQrResponse,
  PartnerQrCardResponse,
  QRCodeType,
  PartnerLoginPayload,
  PaginatedResponse,
  ProgramSettings,
  UpdateProgramSettingsPayload,
  SuperAdminProfile,
  Outlet,
  AdminOutlet,
  CreateOutletPayload,
  UpdateOutletPayload,
  UpdateOutletProfilePayload,
  MediaUploadPayload,
  MediaUploadResponse,
  LoginPayload,
  OutletAdminSession,
  ScanResult,
  BillPreviewPayload,
  BillCreatePayload,
  BillCalculation,
  BillCreateResponse,
  BillRecord,
  BillHistoryRange,
  BillHistorySummary,
  CustomerLookup,
  PartnerWallet,
  PartnerHome,
  PartnerOffers,
  PartnerNotificationPage,
  PushTokenPayload,
  RedeemQr,
  RedeemScanResult,
  RedeemPayload,
  RedemptionReceipt,
  UpdatePartnerProfilePayload,
  AdminDashboard,
  AdminSearchResult,
  AdminPartnerDetail,
  AdminPartnerListItem,
  AdminPartnerListQuery,
  AdminTransactionListQuery,
  AdminTransactionPage,
  AdminDashboardQuery,
  AdminDateRangeQuery,
  AdminOutletListQuery,
  AdminOutletRedemptionsPage,
  AdminOutletRedemptionsQuery,
  AdminPartnerActivityPage,
  AdminPartnerActivityQuery,
  AdminTestPushResult,
  AdminAccount,
  CreateAdminAccountPayload,
  UpdateAdminAccountPayload,
  DeletionImpact,
  AdminOutletOption,
} from '@lotmorewins/types';

export interface ApiClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  timeoutMs?: number;
  getAuthToken?: () => string | null | Promise<string | null>;
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiClientError.prototype);
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly timeoutMs: number;
  private readonly getAuthToken?: () => string | null | Promise<string | null>;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...config.defaultHeaders,
    };
    this.timeoutMs = config.timeoutMs ?? 15000;
    this.getAuthToken = config.getAuthToken;
  }

  public async request<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, timeoutMs, headers = {}, ...customConfig } = options;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    let urlString = `${this.baseUrl}${cleanEndpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        urlString += (urlString.includes('?') ? '&' : '?') + queryString;
      }
    }

    const mergedHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...(headers as Record<string, string>),
    };

    if (this.getAuthToken && !mergedHeaders.Authorization) {
      const token = await this.getAuthToken();
      if (token) {
        mergedHeaders.Authorization = `Bearer ${token}`;
      }
    }

    const controller = new AbortController();
    const effectiveTimeout = timeoutMs ?? this.timeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    try {
      const response = await fetch(urlString, {
        ...customConfig,
        headers: mergedHeaders,
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
        let errorCode: string | undefined;
        let errorDetails: unknown;

        if (isJson && typeof data === 'object' && data !== null) {
          const jsonObj = data as Record<string, unknown>;
          if (typeof jsonObj.message === 'string') {
            errorMessage = jsonObj.message;
          }
          if (typeof jsonObj.code === 'string') {
            errorCode = jsonObj.code;
          }
          errorDetails = jsonObj.details || jsonObj.errors;
        }

        throw new ApiClientError(response.status, errorMessage, errorCode, errorDetails);
      }

      return data as T;
    } catch (error: unknown) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiClientError(408, `Request timed out after ${effectiveTimeout}ms`, 'TIMEOUT');
      }
      const message = error instanceof Error ? error.message : 'Unknown network error';
      throw new ApiClientError(0, message, 'NETWORK_ERROR');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public put<T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T, B = unknown>(endpoint: string, body?: B, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  public checkHealth(): Promise<HealthCheckResponse> {
    return this.get<HealthCheckResponse>('/health');
  }

  // ==========================================================================
  // Phase 2: Onboarding & Authentication Methods
  // ==========================================================================

  public sendOtp(payload: OtpSendPayload): Promise<OtpSendResponse> {
    return this.post<OtpSendResponse>('/auth/otp', payload);
  }

  public verifyOtp(payload: OtpVerifyPayload): Promise<OtpVerifyResponse> {
    return this.put<OtpVerifyResponse>('/auth/otp', payload);
  }

  public registerPartner(payload: PartnerOnboardingPayload): Promise<ApiResponse<PartnerOnboardingResponse>> {
    return this.post<ApiResponse<PartnerOnboardingResponse>>('/partner/onboarding', payload);
  }

  /** Partner sign-in with registered mobile/email and password; returns the same session shape as onboarding. */
  public partnerLogin(payload: PartnerLoginPayload): Promise<ApiResponse<PartnerOnboardingResponse>> {
    return this.post<ApiResponse<PartnerOnboardingResponse>>('/partner/auth/login', payload);
  }

  public getPartnerQrCodes(): Promise<ApiResponse<PartnerQrResponse>> {
    return this.get<ApiResponse<PartnerQrResponse>>('/partner/qr');
  }

  /** The partner is identified by the Bearer token only. */
  public getPartnerMe(): Promise<ApiResponse<PartnerOnboardingResponse>> {
    return this.get<ApiResponse<PartnerOnboardingResponse>>('/partner/me');
  }

  /** Edits the partner's own profile. A new mobile or email must have been OTP-verified first. */
  public updatePartnerProfile(payload: UpdatePartnerProfilePayload): Promise<ApiResponse<PartnerOnboardingResponse>> {
    return this.patch<ApiResponse<PartnerOnboardingResponse>>('/partner/me', payload);
  }

  /** Public: the first-purchase and birthday offers advertised during registration. */
  public getPartnerOffers(): Promise<ApiResponse<PartnerOffers>> {
    return this.get<ApiResponse<PartnerOffers>>('/partner/offers');
  }

  /** Referral progress, current offers and the unread notification count for the Home screen. */
  public getPartnerHome(): Promise<ApiResponse<PartnerHome>> {
    return this.get<ApiResponse<PartnerHome>>('/partner/home');
  }

  /** Records one tap of "Share QR" on the referral QR page (Super Admin tracking). */
  /** The partner's own QR as a branded PNG card, for download and sharing. */
  public getPartnerQrCard(type: QRCodeType): Promise<ApiResponse<PartnerQrCardResponse>> {
    return this.get<ApiResponse<PartnerQrCardResponse>>('/partner/qr-card', { params: { type }, timeoutMs: 30000 });
  }

  public trackReferralShare(): Promise<ApiResponse<{ recorded: boolean }>> {
    return this.post<ApiResponse<{ recorded: boolean }>>('/partner/referral-share');
  }

  public getPartnerNotifications(page = 1, limit = 30): Promise<ApiResponse<PartnerNotificationPage>> {
    return this.get<ApiResponse<PartnerNotificationPage>>('/partner/notifications', { params: { page, limit } });
  }

  public markPartnerNotificationsRead(): Promise<ApiResponse<{ updated: number }>> {
    return this.post<ApiResponse<{ updated: number }>>('/partner/notifications/read');
  }

  public registerPushToken(payload: PushTokenPayload): Promise<ApiResponse<{ registered: boolean }>> {
    return this.post<ApiResponse<{ registered: boolean }>>('/partner/push-token', payload);
  }

  public removePushToken(token: string): Promise<ApiResponse<{ removed: boolean }>> {
    return this.delete<ApiResponse<{ removed: boolean }>>('/partner/push-token', { params: { token } });
  }


  /** Active outlets managed by the Super Admin. */
  public getOutlets(): Promise<ApiResponse<Outlet[]>> {
    return this.get<ApiResponse<Outlet[]>>('/outlets');
  }

  /** Public: active outlet names for the "Referred by" list shown while registering. */
  public getOutletOptions(): Promise<ApiResponse<OutletOption[]>> {
    return this.get<ApiResponse<OutletOption[]>>('/outlets/options');
  }

  // ==========================================================================
  // Phase 3: Super Admin (session cookie on the web panel)
  // ==========================================================================

  public adminLogin(payload: LoginPayload): Promise<ApiResponse<{ admin: SuperAdminProfile }>> {
    return this.post<ApiResponse<{ admin: SuperAdminProfile }>>('/admin/auth/login', payload);
  }

  public adminLogout(): Promise<ApiResponse<{ signedOut: boolean }>> {
    return this.post<ApiResponse<{ signedOut: boolean }>>('/admin/auth/logout');
  }

  public getAdminSettings(): Promise<ApiResponse<ProgramSettings>> {
    return this.get<ApiResponse<ProgramSettings>>('/admin/settings');
  }

  public updateAdminSettings(payload: UpdateProgramSettingsPayload): Promise<ApiResponse<ProgramSettings>> {
    return this.put<ApiResponse<ProgramSettings>>('/admin/settings', payload);
  }

  public listAdminOutlets(query: AdminOutletListQuery = {}): Promise<ApiResponse<AdminOutlet[]>> {
    return this.get<ApiResponse<AdminOutlet[]>>('/admin/outlets', { params: { ...query } });
  }

  /** Wallet redemptions made at one outlet, with totals for the date filter. */
  public getAdminOutletRedemptions(
    id: string,
    query: AdminOutletRedemptionsQuery = {}
  ): Promise<ApiResponse<AdminOutletRedemptionsPage>> {
    return this.get<ApiResponse<AdminOutletRedemptionsPage>>(`/admin/outlets/${encodeURIComponent(id)}/redemptions`, {
      params: { ...query },
    });
  }

  public getAdminOutlet(id: string): Promise<ApiResponse<AdminOutlet>> {
    return this.get<ApiResponse<AdminOutlet>>(`/admin/outlets/${encodeURIComponent(id)}`);
  }

  public createAdminOutlet(payload: CreateOutletPayload): Promise<ApiResponse<AdminOutlet>> {
    return this.post<ApiResponse<AdminOutlet>>('/admin/outlets', payload);
  }

  public updateAdminOutlet(id: string, payload: UpdateOutletPayload): Promise<ApiResponse<AdminOutlet>> {
    return this.patch<ApiResponse<AdminOutlet>>(`/admin/outlets/${encodeURIComponent(id)}`, payload);
  }

  /** `from` / `to` set the period of the dashboard's metrics and charts (default: last 30 days). */
  /** Partners (name, mobile, email, code, id) and outlets matching one query, for the dashboard search. */
  public adminSearch(q: string): Promise<ApiResponse<AdminSearchResult>> {
    return this.get<ApiResponse<AdminSearchResult>>('/admin/search', { params: { q } });
  }

  public getAdminDashboard(query: AdminDashboardQuery = {}): Promise<ApiResponse<AdminDashboard>> {
    return this.get<ApiResponse<AdminDashboard>>('/admin/dashboard', { params: { ...query } });
  }

  public listAdminPartners(query: AdminPartnerListQuery = {}): Promise<PaginatedResponse<AdminPartnerListItem>> {
    return this.get<PaginatedResponse<AdminPartnerListItem>>('/admin/partners', { params: { ...query } });
  }

  public getAdminPartner(id: string): Promise<ApiResponse<AdminPartnerDetail>> {
    return this.get<ApiResponse<AdminPartnerDetail>>(`/admin/partners/${encodeURIComponent(id)}`);
  }

  /** One partner's activity log: own purchases, successful referrals, redemptions and QR shares. */
  /** Outlet ids and names for filter dropdowns (any admin with Outlets, Partners or Transactions). */
  public listAdminOutletOptions(): Promise<ApiResponse<AdminOutletOption[]>> {
    return this.get<ApiResponse<AdminOutletOption[]>>('/admin/outlets', { params: { view: 'options' } });
  }

  // --- Admin accounts (Super Admin only) -------------------------------------------------

  public getAdminMe(): Promise<ApiResponse<{ admin: SuperAdminProfile }>> {
    return this.get<ApiResponse<{ admin: SuperAdminProfile }>>('/admin/auth/me');
  }

  public listAdminAccounts(): Promise<ApiResponse<AdminAccount[]>> {
    return this.get<ApiResponse<AdminAccount[]>>('/admin/admins');
  }

  public createAdminAccount(payload: CreateAdminAccountPayload): Promise<ApiResponse<AdminAccount>> {
    return this.post<ApiResponse<AdminAccount>>('/admin/admins', payload);
  }

  public updateAdminAccount(id: string, payload: UpdateAdminAccountPayload): Promise<ApiResponse<AdminAccount>> {
    return this.patch<ApiResponse<AdminAccount>>(`/admin/admins/${encodeURIComponent(id)}`, payload);
  }

  public deleteAdminAccount(id: string): Promise<ApiResponse<{ deleted: boolean }>> {
    return this.delete<ApiResponse<{ deleted: boolean }>>(`/admin/admins/${encodeURIComponent(id)}`);
  }

  // --- Permanent deletes (need the page and the delete permission) ----------------------

  public getPartnerDeletionImpact(id: string): Promise<ApiResponse<DeletionImpact>> {
    return this.get<ApiResponse<DeletionImpact>>(`/admin/partners/${encodeURIComponent(id)}/deletion`);
  }

  public deleteAdminPartner(id: string): Promise<ApiResponse<DeletionImpact>> {
    return this.delete<ApiResponse<DeletionImpact>>(`/admin/partners/${encodeURIComponent(id)}`, { timeoutMs: 60000 });
  }

  public getOutletDeletionImpact(id: string): Promise<ApiResponse<DeletionImpact>> {
    return this.get<ApiResponse<DeletionImpact>>(`/admin/outlets/${encodeURIComponent(id)}/deletion`);
  }

  public deleteAdminOutlet(id: string): Promise<ApiResponse<DeletionImpact>> {
    return this.delete<ApiResponse<DeletionImpact>>(`/admin/outlets/${encodeURIComponent(id)}`, { timeoutMs: 60000 });
  }

  public deleteAdminTransaction(id: string): Promise<ApiResponse<{ billNumber: string; pointsEntries: number }>> {
    return this.delete<ApiResponse<{ billNumber: string; pointsEntries: number }>>(`/admin/transactions/${encodeURIComponent(id)}`);
  }

  /** Sends a test notification to the partner's phones and reports the delivery outcome. */
  public sendAdminTestPush(id: string): Promise<ApiResponse<AdminTestPushResult>> {
    return this.post<ApiResponse<AdminTestPushResult>>(`/admin/partners/${encodeURIComponent(id)}/test-push`);
  }

  public getAdminPartnerActivity(id: string, query: AdminPartnerActivityQuery = {}): Promise<ApiResponse<AdminPartnerActivityPage>> {
    return this.get<ApiResponse<AdminPartnerActivityPage>>(`/admin/partners/${encodeURIComponent(id)}/activity`, {
      params: { ...query },
    });
  }

  public listAdminTransactions(query: AdminTransactionListQuery = {}): Promise<ApiResponse<AdminTransactionPage>> {
    return this.get<ApiResponse<AdminTransactionPage>>('/admin/transactions', { params: { ...query } });
  }

  public uploadMedia(payload: MediaUploadPayload): Promise<ApiResponse<MediaUploadResponse>> {
    return this.post<ApiResponse<MediaUploadResponse>>('/media', payload, { timeoutMs: 60000 });
  }

  // ==========================================================================
  // Phase 3: Outlet Admin (Bearer token)
  // ==========================================================================

  public outletLogin(payload: LoginPayload): Promise<ApiResponse<OutletAdminSession>> {
    return this.post<ApiResponse<OutletAdminSession>>('/outlet/auth/login', payload);
  }

  public getOutletProfile(): Promise<ApiResponse<Outlet>> {
    return this.get<ApiResponse<Outlet>>('/outlet/profile');
  }

  public updateOutletProfile(payload: UpdateOutletProfilePayload): Promise<ApiResponse<Outlet>> {
    return this.patch<ApiResponse<Outlet>>('/outlet/profile', payload);
  }

  public scanQr(qrCode: string): Promise<ApiResponse<ScanResult>> {
    return this.post<ApiResponse<ScanResult>>('/outlet/scan', { qrCode });
  }

  public previewBill(payload: BillPreviewPayload): Promise<ApiResponse<BillCalculation>> {
    return this.post<ApiResponse<BillCalculation>>('/outlet/bills/preview', payload);
  }

  /** Also sends the bill message before responding, hence the longer timeout. Safe to retry with the same key. */
  public createBill(payload: BillCreatePayload): Promise<ApiResponse<BillCreateResponse>> {
    return this.post<ApiResponse<BillCreateResponse>>('/outlet/bills', payload, { timeoutMs: 45000 });
  }

  public lookupCustomer(mobile: string): Promise<ApiResponse<CustomerLookup | null>> {
    return this.get<ApiResponse<CustomerLookup | null>>('/outlet/customers/lookup', { params: { mobile } });
  }

  public getOutletTransactions(
    page = 1,
    limit = 20,
    range: BillHistoryRange = 'all'
  ): Promise<PaginatedResponse<BillRecord> & { meta: { range: BillHistoryRange; summary: BillHistorySummary } }> {
    return this.get('/outlet/transactions', { params: { page, limit, range } });
  }

  public getOutletBill(id: string): Promise<ApiResponse<BillRecord>> {
    return this.get<ApiResponse<BillRecord>>(`/outlet/bills/${encodeURIComponent(id)}`);
  }

  public resendBillNotification(id: string): Promise<ApiResponse<BillRecord>> {
    return this.post<ApiResponse<BillRecord>>(`/outlet/bills/${encodeURIComponent(id)}/notify`, undefined, {
      timeoutMs: 30000,
    });
  }

  // ==========================================================================
  // Partner wallet (Bearer partner token)
  // ==========================================================================

  public getPartnerWallet(): Promise<ApiResponse<PartnerWallet>> {
    return this.get<ApiResponse<PartnerWallet>>('/partner/wallet');
  }

  /** A fresh, short-lived, single-use QR for spending wallet points at an outlet. */
  public createRedeemQr(): Promise<ApiResponse<RedeemQr>> {
    return this.post<ApiResponse<RedeemQr>>('/partner/wallet/redeem-qr');
  }

  // ==========================================================================
  // Outlet Admin: wallet redemption (Bearer outlet admin token)
  // ==========================================================================

  /** Resolves a scanned redeem QR to the partner and their live wallet balance. */
  public scanRedeemQr(qrCode: string): Promise<ApiResponse<RedeemScanResult>> {
    return this.post<ApiResponse<RedeemScanResult>>('/outlet/redemptions/scan', { qrCode });
  }

  /** Spends points from the partner's wallet. Each redeem QR works once; a retry replays the result. */
  public redeemPoints(payload: RedeemPayload): Promise<ApiResponse<RedemptionReceipt>> {
    return this.post<ApiResponse<RedemptionReceipt>>('/outlet/redemptions', payload, { timeoutMs: 30000 });
  }

  /** Resolves an API-hosted asset path (/api/media/...) against the API origin. */
  public resolveAssetUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (/^https?:\/\//i.test(url)) return url;
    const origin = this.baseUrl.replace(/\/api$/, '');
    return `${origin}${url}`;
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}
