export type OrganizationType =
  | 'SCHOOL'
  | 'PUBLISHER'
  | 'ACADEMY'
  | 'COMPANY'
  | 'TRAINING_CENTER'
  | 'MEDIA_BRAND';

export type MemberRole =
  | 'ORG_ADMIN'
  | 'SCHOOL_ADMIN'
  | 'TEACHER'
  | 'STUDENT'
  | 'PUBLISHER_ADMIN'
  | 'PUBLISHER_EDITOR'
  | 'ANALYST';

export interface TenantContext {
  organizationId: string;
  memberId?: string;
  roleKeys?: string[];
}
