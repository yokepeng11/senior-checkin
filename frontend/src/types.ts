export interface Senior {
  senior_id: string;
  name: string;
  phone_number?: string;
  preferred_checkin_time: string;
  person_in_charge_name?: string;
  person_in_charge_phone?: string;
  person_in_charge_email?: string;
  nok_name?: string;
  next_of_kin_phone?: string;
  next_of_kin_email?: string;
  is_active: number;
  created_at?: string;
}

export interface DailyStatus {
  checked_in: boolean;
  last_checkin_time: string | null;
  date: string;
}

export interface DashboardSenior extends Senior {
  today_status: DailyStatus;
  check_in_rate: number;
}

export interface Dashboard {
  date: string;
  total_seniors: number;
  checked_in_today: number;
  not_checked_in: number;
  seniors: DashboardSenior[];
}

export interface CheckinHistory {
  date: string;
  checked_in_today: number;
  last_checkin_time: string | null;
}

export interface Report {
  senior: Senior;
  period: string;
  total_days: number;
  checked_in_days: number;
  missed_days: number;
  check_in_rate: number;
  missed_dates: string[];
  history: CheckinHistory[];
  trend: 'stable' | 'declining' | 'critical';
}
