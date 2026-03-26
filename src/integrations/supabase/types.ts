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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          requested_role: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          address: string
          city: string
          client_id: string
          client_name: string
          created_at: string
          date_signed: string
          deal_status: Database["public"]["Enums"]["deal_status"]
          delivery_date: string
          estimator: string
          freight_status: Database["public"]["Enums"]["freight_status"]
          height: number
          id: string
          insulation_status: string
          job_id: string
          job_name: string
          length: number
          notes: string
          order_type: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_date: string
          postal_code: string
          production_status: Database["public"]["Enums"]["production_stage"]
          province: string
          sales_rep: string
          sqft: number
          tax_rate: number
          tax_type: string
          team_lead: string
          weight: number
          width: number
        }
        Insert: {
          address?: string
          city?: string
          client_id?: string
          client_name?: string
          created_at?: string
          date_signed?: string
          deal_status?: Database["public"]["Enums"]["deal_status"]
          delivery_date?: string
          estimator?: string
          freight_status?: Database["public"]["Enums"]["freight_status"]
          height?: number
          id?: string
          insulation_status?: string
          job_id?: string
          job_name?: string
          length?: number
          notes?: string
          order_type?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_date?: string
          postal_code?: string
          production_status?: Database["public"]["Enums"]["production_stage"]
          province?: string
          sales_rep?: string
          sqft?: number
          tax_rate?: number
          tax_type?: string
          team_lead?: string
          weight?: number
          width?: number
        }
        Update: {
          address?: string
          city?: string
          client_id?: string
          client_name?: string
          created_at?: string
          date_signed?: string
          deal_status?: Database["public"]["Enums"]["deal_status"]
          delivery_date?: string
          estimator?: string
          freight_status?: Database["public"]["Enums"]["freight_status"]
          height?: number
          id?: string
          insulation_status?: string
          job_id?: string
          job_name?: string
          length?: number
          notes?: string
          order_type?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_date?: string
          postal_code?: string
          production_status?: Database["public"]["Enums"]["production_stage"]
          province?: string
          sales_rep?: string
          sqft?: number
          tax_rate?: number
          tax_type?: string
          team_lead?: string
          weight?: number
          width?: number
        }
        Relationships: []
      }
      freight: {
        Row: {
          actual_freight: number
          building_size: string
          carrier: string
          client_name: string
          created_at: string
          delivery_address: string
          est_distance: number
          est_freight: number
          id: string
          job_id: string
          paid: boolean
          pickup_address: string
          status: Database["public"]["Enums"]["freight_status"]
          weight: number
        }
        Insert: {
          actual_freight?: number
          building_size?: string
          carrier?: string
          client_name?: string
          created_at?: string
          delivery_address?: string
          est_distance?: number
          est_freight?: number
          id?: string
          job_id: string
          paid?: boolean
          pickup_address?: string
          status?: Database["public"]["Enums"]["freight_status"]
          weight?: number
        }
        Update: {
          actual_freight?: number
          building_size?: string
          carrier?: string
          client_name?: string
          created_at?: string
          delivery_address?: string
          est_distance?: number
          est_freight?: number
          id?: string
          job_id?: string
          paid?: boolean
          pickup_address?: string
          status?: Database["public"]["Enums"]["freight_status"]
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "freight_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["job_id"]
          },
        ]
      }
      internal_costs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          rep_foundation_drawing: number
          rep_freight: number
          rep_insulation: number
          rep_material: number
          rep_structural_drawing: number
          sale_price: number
          show_rep_costs: boolean
          true_foundation_drawing: number
          true_freight: number
          true_insulation: number
          true_material: number
          true_structural_drawing: number
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          rep_foundation_drawing?: number
          rep_freight?: number
          rep_insulation?: number
          rep_material?: number
          rep_structural_drawing?: number
          sale_price?: number
          show_rep_costs?: boolean
          true_foundation_drawing?: number
          true_freight?: number
          true_insulation?: number
          true_material?: number
          true_structural_drawing?: number
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          rep_foundation_drawing?: number
          rep_freight?: number
          rep_insulation?: number
          rep_material?: number
          rep_structural_drawing?: number
          sale_price?: number
          show_rep_costs?: boolean
          true_foundation_drawing?: number
          true_freight?: number
          true_insulation?: number
          true_material?: number
          true_structural_drawing?: number
        }
        Relationships: [
          {
            foreignKeyName: "internal_costs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["job_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_excl_tax: number
          client_vendor_name: string
          created_at: string
          date: string
          direction: Database["public"]["Enums"]["payment_direction"]
          id: string
          job_id: string
          notes: string
          payment_method: string
          province: string
          qb_synced: boolean
          reference_number: string
          tax_amount: number
          tax_rate: number
          total_incl_tax: number
          type: Database["public"]["Enums"]["payment_type"]
        }
        Insert: {
          amount_excl_tax?: number
          client_vendor_name?: string
          created_at?: string
          date?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          id?: string
          job_id?: string
          notes?: string
          payment_method?: string
          province?: string
          qb_synced?: boolean
          reference_number?: string
          tax_amount?: number
          tax_rate?: number
          total_incl_tax?: number
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Update: {
          amount_excl_tax?: number
          client_vendor_name?: string
          created_at?: string
          date?: string
          direction?: Database["public"]["Enums"]["payment_direction"]
          id?: string
          job_id?: string
          notes?: string
          payment_method?: string
          province?: string
          qb_synced?: boolean
          reference_number?: string
          tax_amount?: number
          tax_rate?: number
          total_incl_tax?: number
          type?: Database["public"]["Enums"]["payment_type"]
        }
        Relationships: []
      }
      production: {
        Row: {
          acknowledged: boolean
          created_at: string
          delivered: boolean
          drawings_status: string
          id: string
          in_production: boolean
          insulation_status: string
          job_id: string
          qc_complete: boolean
          ship_ready: boolean
          shipped: boolean
          submitted: boolean
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          delivered?: boolean
          drawings_status?: string
          id?: string
          in_production?: boolean
          insulation_status?: string
          job_id: string
          qc_complete?: boolean
          ship_ready?: boolean
          shipped?: boolean
          submitted?: boolean
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          delivered?: boolean
          drawings_status?: string
          id?: string
          in_production?: boolean
          insulation_status?: string
          job_id?: string
          qc_complete?: boolean
          ship_ready?: boolean
          shipped?: boolean
          submitted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "production_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["job_id"]
          },
        ]
      }
      quotes: {
        Row: {
          address: string
          adjusted_steel: number
          base_steel_cost: number
          city: string
          client_id: string
          client_name: string
          combined_total: number
          contingency: number
          contingency_pct: number
          created_at: string
          date: string
          engineering: number
          estimator: string
          foundation: number
          foundation_type: Database["public"]["Enums"]["foundation_type"]
          freight: number
          grand_total: number
          gst_hst: number
          gutters: number
          height: number
          id: string
          insulation: number
          insulation_grade: string
          job_id: string
          job_name: string
          length: number
          liners: number
          markup: number
          per_lb: number
          per_sqft: number
          postal_code: string
          province: string
          qst: number
          sales_rep: string
          sqft: number
          status: Database["public"]["Enums"]["quote_status"]
          steel_after_12: number
          weight: number
          width: number
        }
        Insert: {
          address?: string
          adjusted_steel?: number
          base_steel_cost?: number
          city?: string
          client_id?: string
          client_name?: string
          combined_total?: number
          contingency?: number
          contingency_pct?: number
          created_at?: string
          date?: string
          engineering?: number
          estimator?: string
          foundation?: number
          foundation_type?: Database["public"]["Enums"]["foundation_type"]
          freight?: number
          grand_total?: number
          gst_hst?: number
          gutters?: number
          height?: number
          id?: string
          insulation?: number
          insulation_grade?: string
          job_id?: string
          job_name?: string
          length?: number
          liners?: number
          markup?: number
          per_lb?: number
          per_sqft?: number
          postal_code?: string
          province?: string
          qst?: number
          sales_rep?: string
          sqft?: number
          status?: Database["public"]["Enums"]["quote_status"]
          steel_after_12?: number
          weight?: number
          width?: number
        }
        Update: {
          address?: string
          adjusted_steel?: number
          base_steel_cost?: number
          city?: string
          client_id?: string
          client_name?: string
          combined_total?: number
          contingency?: number
          contingency_pct?: number
          created_at?: string
          date?: string
          engineering?: number
          estimator?: string
          foundation?: number
          foundation_type?: Database["public"]["Enums"]["foundation_type"]
          freight?: number
          grand_total?: number
          gst_hst?: number
          gutters?: number
          height?: number
          id?: string
          insulation?: number
          insulation_grade?: string
          job_id?: string
          job_name?: string
          length?: number
          liners?: number
          markup?: number
          per_lb?: number
          per_sqft?: number
          postal_code?: string
          province?: string
          qst?: number
          sales_rep?: string
          sqft?: number
          status?: Database["public"]["Enums"]["quote_status"]
          steel_after_12?: number
          weight?: number
          width?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "owner"
        | "accounting"
        | "operations"
        | "sales_rep"
        | "freight"
      deal_status:
        | "Lead"
        | "Quoted"
        | "Pending Payment"
        | "In Progress"
        | "In Production"
        | "Shipped"
        | "Delivered"
        | "Complete"
        | "Cancelled"
        | "On Hold"
      foundation_type: "slab" | "frost_wall"
      freight_status: "Pending" | "Booked" | "In Transit" | "Delivered"
      payment_direction:
        | "Client Payment IN"
        | "Vendor Payment OUT"
        | "Refund IN"
        | "Refund OUT"
      payment_status: "PAID" | "PARTIAL" | "UNPAID"
      payment_type:
        | "Deposit"
        | "Progress Payment"
        | "Final Payment"
        | "Freight"
        | "Insulation"
        | "Drawings"
        | "Other"
      production_stage:
        | "Submitted"
        | "Acknowledged"
        | "In Production"
        | "QC Complete"
        | "Ship Ready"
        | "Shipped"
        | "Delivered"
      quote_status: "Draft" | "Sent" | "Follow Up" | "Won" | "Lost" | "Expired"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: [
        "admin",
        "owner",
        "accounting",
        "operations",
        "sales_rep",
        "freight",
      ],
      deal_status: [
        "Lead",
        "Quoted",
        "Pending Payment",
        "In Progress",
        "In Production",
        "Shipped",
        "Delivered",
        "Complete",
        "Cancelled",
        "On Hold",
      ],
      foundation_type: ["slab", "frost_wall"],
      freight_status: ["Pending", "Booked", "In Transit", "Delivered"],
      payment_direction: [
        "Client Payment IN",
        "Vendor Payment OUT",
        "Refund IN",
        "Refund OUT",
      ],
      payment_status: ["PAID", "PARTIAL", "UNPAID"],
      payment_type: [
        "Deposit",
        "Progress Payment",
        "Final Payment",
        "Freight",
        "Insulation",
        "Drawings",
        "Other",
      ],
      production_stage: [
        "Submitted",
        "Acknowledged",
        "In Production",
        "QC Complete",
        "Ship Ready",
        "Shipped",
        "Delivered",
      ],
      quote_status: ["Draft", "Sent", "Follow Up", "Won", "Lost", "Expired"],
    },
  },
} as const
