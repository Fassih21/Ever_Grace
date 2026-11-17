export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appt_date: string
          cancel_reason: string | null
          created_at: string
          created_by: string
          id: string
          patient_id: string
          plan_id: string | null
          service_id: string
          slots_count: number
          start_slot: number
          status: Database["public"]["Enums"]["appointment_status"]
          total_amount: number
          discount_amount: number
          updated_at: string
        }
        Insert: {
          appt_date: string
          cancel_reason?: string | null
          created_at?: string
          created_by?: string
          id?: string
          patient_id: string
          plan_id?: string | null
          service_id: string
          slots_count?: number
          start_slot: number
          status?: Database["public"]["Enums"]["appointment_status"]
          total_amount: number
          discount_amount?: number
          updated_at?: string
        }
        Update: {
          appt_date?: string
          cancel_reason?: string | null
          created_at?: string
          created_by?: string
          id?: string
          patient_id?: string
          plan_id?: string | null
          service_id?: string
          slots_count?: number
          start_slot?: number
          status?: Database["public"]["Enums"]["appointment_status"]
          total_amount?: number
          discount_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_start_slot_fkey"
            columns: ["start_slot"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["sort_order"]
          },
        ]
      }
      attendance: {
        Row: {
          created_at: string
          created_by: string
          id: string
          staff_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          work_date: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          staff_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_date: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          staff_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          note: string | null
          spent_on: string
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          spent_on: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          note?: string | null
          spent_on?: string
          updated_at?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          name: string
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          appointment_id: string
          created_at: string
          created_by: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at: string
          patient_id: string
          updated_at: string
          void_reason: string | null
          voided: boolean
        }
        Insert: {
          amount: number
          appointment_id: string
          created_at?: string
          created_by?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          patient_id: string
          updated_at?: string
          void_reason?: string | null
          voided?: boolean
        }
        Update: {
          amount?: number
          appointment_id?: string
          created_at?: string
          created_by?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          paid_at?: string
          patient_id?: string
          updated_at?: string
          void_reason?: string | null
          voided?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointment_balance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_name: string
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      salaries: {
        Row: {
          advance: number
          base: number
          created_at: string
          created_by: string
          deductions: number
          id: string
          month: string
          net: number
          paid_on: string | null
          staff_id: string
          status: Database["public"]["Enums"]["salary_status"]
          updated_at: string
        }
        Insert: {
          advance?: number
          base: number
          created_at?: string
          created_by?: string
          deductions?: number
          id?: string
          month: string
          net: number
          paid_on?: string | null
          staff_id: string
          status?: Database["public"]["Enums"]["salary_status"]
          updated_at?: string
        }
        Update: {
          advance?: number
          base?: number
          created_at?: string
          created_by?: string
          deductions?: number
          id?: string
          month?: string
          net?: number
          paid_on?: string | null
          staff_id?: string
          status?: Database["public"]["Enums"]["salary_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "salaries_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          default_price: number
          default_slots: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_price?: number
          default_slots?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          default_price?: number
          default_slots?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      slots: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          label: string
          sort_order: number
          start_time: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          label: string
          sort_order: number
          start_time: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          label?: string
          sort_order?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          active: boolean
          base_salary: number
          created_at: string
          created_by: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_salary?: number
          created_at?: string
          created_by?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_salary?: number
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      treatment_plans: {
        Row: {
          created_at: string
          created_by: string
          id: string
          patient_id: string
          service_id: string
          status: Database["public"]["Enums"]["treatment_plan_status"]
          total_price: number
          total_sessions: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          patient_id: string
          service_id: string
          status?: Database["public"]["Enums"]["treatment_plan_status"]
          total_price?: number
          total_sessions: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          patient_id?: string
          service_id?: string
          status?: Database["public"]["Enums"]["treatment_plan_status"]
          total_price?: number
          total_sessions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treatment_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treatment_plans_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["clinic_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["clinic_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["clinic_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      appointment_balance: {
        Row: {
          appt_date: string | null
          balance: number | null
          cancel_reason: string | null
          created_at: string | null
          created_by: string | null
          id: string | null
          paid_total: number | null
          patient_id: string | null
          plan_id: string | null
          service_id: string | null
          slots_count: number | null
          start_slot: number | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          total_amount: number | null
          discount_amount: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "treatment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_start_slot_fkey"
            columns: ["start_slot"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["sort_order"]
          },
        ]
      }
    }
    Functions: {
      book_appointment: {
        Args: {
          p_advance_amount?: number
          p_discount_amount?: number
          p_appt_date: string
          p_name: string
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
          p_phone: string
          p_plan_id?: string
          p_service_id: string
          p_slots_count: number
          p_start_slot: number
          p_total_amount: number
        }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["clinic_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_active_user: { Args: never; Returns: boolean }
      receive_appointment_payment: {
        Args: {
          p_amount: number
          p_appointment_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: string
      }
    }
    Enums: {
      appointment_status: "booked" | "completed" | "cancelled" | "no_show"
      attendance_status: "present" | "absent" | "late" | "half_day" | "leave"
      clinic_role: "owner" | "manager"
      payment_method: "cash" | "card" | "bank_transfer"
      salary_status: "pending" | "paid"
      treatment_plan_status: "active" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: ["booked", "completed", "cancelled", "no_show"],
      attendance_status: ["present", "absent", "late", "half_day", "leave"],
      clinic_role: ["owner", "manager"],
      payment_method: ["cash", "card", "bank_transfer"],
      salary_status: ["pending", "paid"],
      treatment_plan_status: ["active", "completed", "cancelled"],
    },
  },
} as const
