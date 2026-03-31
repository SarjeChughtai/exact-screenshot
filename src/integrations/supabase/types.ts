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
          name: string
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
          name?: string
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
          name?: string
          requested_role?: Database["public"]["Enums"]["app_role"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_provider_settings: {
        Row: {
          api_key: string
          base_url: string | null
          created_at: string
          id: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string
          base_url?: string | null
          created_at?: string
          id?: string
          provider?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          base_url?: string | null
          created_at?: string
          id?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          client_id: string | null
          client_name: string
          contact_email: string
          contact_phone: string
          created_at: string
          id: string
          job_ids: string[]
          name: string
          notes: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string
          contact_email?: string
          contact_phone?: string
          created_at?: string
          id?: string
          job_ids?: string[]
          name?: string
          notes?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          contact_email?: string
          contact_phone?: string
          created_at?: string
          id?: string
          job_ids?: string[]
          name?: string
          notes?: string
        }
        Relationships: []
      }
      cost_data: {
        Row: {
          category: string
          created_at: string
          date: string | null
          description: string
          id: string
          imported_at: string
          imported_by: string | null
          project_id: string | null
          quantity: number
          source_document: string
          total: number
          unit_price: number
          vendor: string
        }
        Insert: {
          category?: string
          created_at?: string
          date?: string | null
          description?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          project_id?: string | null
          quantity?: number
          source_document?: string
          total?: number
          unit_price?: number
          vendor?: string
        }
        Update: {
          category?: string
          created_at?: string
          date?: string | null
          description?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          project_id?: string | null
          quantity?: number
          source_document?: string
          total?: number
          unit_price?: number
          vendor?: string
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
      ghl_contacts: {
        Row: {
          company: string | null
          email: string | null
          ghl_id: string
          id: string
          name: string | null
          phone: string | null
          raw_data: Json | null
          synced_at: string | null
          tags: string[] | null
        }
        Insert: {
          company?: string | null
          email?: string | null
          ghl_id: string
          id?: string
          name?: string | null
          phone?: string | null
          raw_data?: Json | null
          synced_at?: string | null
          tags?: string[] | null
        }
        Update: {
          company?: string | null
          email?: string | null
          ghl_id?: string
          id?: string
          name?: string | null
          phone?: string | null
          raw_data?: Json | null
          synced_at?: string | null
          tags?: string[] | null
        }
        Relationships: []
      }
      ghl_opportunities: {
        Row: {
          contact_ghl_id: string | null
          ghl_id: string
          id: string
          monetary_value: number | null
          name: string | null
          pipeline_name: string | null
          raw_data: Json | null
          stage_name: string | null
          status: string | null
          synced_at: string | null
        }
        Insert: {
          contact_ghl_id?: string | null
          ghl_id: string
          id?: string
          monetary_value?: number | null
          name?: string | null
          pipeline_name?: string | null
          raw_data?: Json | null
          stage_name?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Update: {
          contact_ghl_id?: string | null
          ghl_id?: string
          id?: string
          monetary_value?: number | null
          name?: string | null
          pipeline_name?: string | null
          raw_data?: Json | null
          stage_name?: string | null
          status?: string | null
          synced_at?: string | null
        }
        Relationships: []
      }
      import_history: {
        Row: {
          created_at: string
          filename: string
          id: string
          items_imported: number
          provider_used: string
          status: string
          total_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          filename?: string
          id?: string
          items_imported?: number
          provider_used?: string
          status?: string
          total_amount?: number
          user_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          items_imported?: number
          provider_used?: string
          status?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: []
      }
      insulation_cost_data: {
        Row: {
          added_by: string | null
          data_source: string | null
          date_added: string | null
          eave_height_ft: number | null
          floor_area_sqft: number | null
          freight_cost: number | null
          fuel_surcharge: number | null
          grade: string | null
          id: string
          length_ft: number | null
          location: string | null
          material_cost: number | null
          material_per_sqft: number | null
          project_id: string | null
          quote_date: string | null
          quote_number: string | null
          roof_area_sqft: number | null
          roof_r_value: string | null
          ship_branch: string | null
          source_file_name: string | null
          source_file_path: string | null
          total_cost: number | null
          total_delivery: number | null
          total_insulated_sqft: number | null
          total_per_sqft: number | null
          wall_area_sqft: number | null
          wall_r_value: string | null
          weight_lb: number | null
          width_ft: number | null
        }
        Insert: {
          added_by?: string | null
          data_source?: string | null
          date_added?: string | null
          eave_height_ft?: number | null
          floor_area_sqft?: number | null
          freight_cost?: number | null
          fuel_surcharge?: number | null
          grade?: string | null
          id?: string
          length_ft?: number | null
          location?: string | null
          material_cost?: number | null
          material_per_sqft?: number | null
          project_id?: string | null
          quote_date?: string | null
          quote_number?: string | null
          roof_area_sqft?: number | null
          roof_r_value?: string | null
          ship_branch?: string | null
          source_file_name?: string | null
          source_file_path?: string | null
          total_cost?: number | null
          total_delivery?: number | null
          total_insulated_sqft?: number | null
          total_per_sqft?: number | null
          wall_area_sqft?: number | null
          wall_r_value?: string | null
          weight_lb?: number | null
          width_ft?: number | null
        }
        Update: {
          added_by?: string | null
          data_source?: string | null
          date_added?: string | null
          eave_height_ft?: number | null
          floor_area_sqft?: number | null
          freight_cost?: number | null
          fuel_surcharge?: number | null
          grade?: string | null
          id?: string
          length_ft?: number | null
          location?: string | null
          material_cost?: number | null
          material_per_sqft?: number | null
          project_id?: string | null
          quote_date?: string | null
          quote_number?: string | null
          roof_area_sqft?: number | null
          roof_r_value?: string | null
          ship_branch?: string | null
          source_file_name?: string | null
          source_file_path?: string | null
          total_cost?: number | null
          total_delivery?: number | null
          total_insulated_sqft?: number | null
          total_per_sqft?: number | null
          wall_area_sqft?: number | null
          wall_r_value?: string | null
          weight_lb?: number | null
          width_ft?: number | null
        }
        Relationships: []
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
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_excl_tax: number
          client_id: string | null
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
          tax_override: boolean
          tax_override_rate: number | null
          tax_rate: number
          total_incl_tax: number
          type: Database["public"]["Enums"]["payment_type"]
          vendor_id: string | null
          vendor_province_override: string | null
        }
        Insert: {
          amount_excl_tax?: number
          client_id?: string | null
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
          tax_override?: boolean
          tax_override_rate?: number | null
          tax_rate?: number
          total_incl_tax?: number
          type?: Database["public"]["Enums"]["payment_type"]
          vendor_id?: string | null
          vendor_province_override?: string | null
        }
        Update: {
          amount_excl_tax?: number
          client_id?: string | null
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
          tax_override?: boolean
          tax_override_rate?: number | null
          tax_rate?: number
          total_incl_tax?: number
          type?: Database["public"]["Enums"]["payment_type"]
          vendor_id?: string | null
          vendor_province_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
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
      qbo_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          id: string
          realm_id: string
          refresh_token: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          id?: string
          realm_id: string
          refresh_token: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          id?: string
          realm_id?: string
          refresh_token?: string
        }
        Relationships: []
      }
      quote_files: {
        Row: {
          ai_output: Json | null
          building_label: string
          client_id: string
          client_name: string
          corrected_data: Json | null
          created_at: string
          extraction_source: string
          file_name: string
          file_size: number
          file_type: string
          gdrive_file_id: string | null
          gdrive_status: string
          id: string
          job_id: string
          parse_error: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          ai_output?: Json | null
          building_label?: string
          client_id?: string
          client_name?: string
          corrected_data?: Json | null
          created_at?: string
          extraction_source?: string
          file_name?: string
          file_size?: number
          file_type?: string
          gdrive_file_id?: string | null
          gdrive_status?: string
          id?: string
          job_id?: string
          parse_error?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Update: {
          ai_output?: Json | null
          building_label?: string
          client_id?: string
          client_name?: string
          corrected_data?: Json | null
          created_at?: string
          extraction_source?: string
          file_name?: string
          file_size?: number
          file_type?: string
          gdrive_file_id?: string | null
          gdrive_status?: string
          id?: string
          job_id?: string
          parse_error?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: []
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
      steel_cost_data: {
        Row: {
          added_by: string | null
          cost_per_sqft: number | null
          data_source: string | null
          date_added: string | null
          eave_height_ft: number | null
          floor_area_sqft: number | null
          id: string
          length_ft: number | null
          price_per_lb: number | null
          project_id: string | null
          province: string | null
          roof_slope: number | null
          seismic_cat: string | null
          snow_load_psf: number | null
          source_file_name: string | null
          source_file_path: string | null
          total_cost: number | null
          total_weight_lb: number | null
          weight_per_sqft: number | null
          width_ft: number | null
          wind_code: string | null
          wind_load_psf: number | null
        }
        Insert: {
          added_by?: string | null
          cost_per_sqft?: number | null
          data_source?: string | null
          date_added?: string | null
          eave_height_ft?: number | null
          floor_area_sqft?: number | null
          id?: string
          length_ft?: number | null
          price_per_lb?: number | null
          project_id?: string | null
          province?: string | null
          roof_slope?: number | null
          seismic_cat?: string | null
          snow_load_psf?: number | null
          source_file_name?: string | null
          source_file_path?: string | null
          total_cost?: number | null
          total_weight_lb?: number | null
          weight_per_sqft?: number | null
          width_ft?: number | null
          wind_code?: string | null
          wind_load_psf?: number | null
        }
        Update: {
          added_by?: string | null
          cost_per_sqft?: number | null
          data_source?: string | null
          date_added?: string | null
          eave_height_ft?: number | null
          floor_area_sqft?: number | null
          id?: string
          length_ft?: number | null
          price_per_lb?: number | null
          project_id?: string | null
          province?: string | null
          roof_slope?: number | null
          seismic_cat?: string | null
          snow_load_psf?: number | null
          source_file_name?: string | null
          source_file_path?: string | null
          total_cost?: number | null
          total_weight_lb?: number | null
          weight_per_sqft?: number | null
          width_ft?: number | null
          wind_code?: string | null
          wind_load_psf?: number | null
        }
        Relationships: []
      }
      steel_cost_entries: {
        Row: {
          ai_raw_output: Json | null
          building_label: string
          city: string | null
          client_id: string
          client_name: string
          components: Json | null
          cost_per_lb: number
          created_at: string
          document_type: string
          extraction_source: string
          file_name: string
          height: number | null
          id: string
          insulation_grade: string | null
          insulation_total: number
          job_id: string
          length: number | null
          province: string | null
          quote_file_id: string | null
          roof_pitch: number | null
          total_cost: number
          uploaded_by: string | null
          weight_lbs: number
          width: number | null
        }
        Insert: {
          ai_raw_output?: Json | null
          building_label?: string
          city?: string | null
          client_id?: string
          client_name?: string
          components?: Json | null
          cost_per_lb?: number
          created_at?: string
          document_type?: string
          extraction_source?: string
          file_name?: string
          height?: number | null
          id?: string
          insulation_grade?: string | null
          insulation_total?: number
          job_id?: string
          length?: number | null
          province?: string | null
          quote_file_id?: string | null
          roof_pitch?: number | null
          total_cost?: number
          uploaded_by?: string | null
          weight_lbs?: number
          width?: number | null
        }
        Update: {
          ai_raw_output?: Json | null
          building_label?: string
          city?: string | null
          client_id?: string
          client_name?: string
          components?: Json | null
          cost_per_lb?: number
          created_at?: string
          document_type?: string
          extraction_source?: string
          file_name?: string
          height?: number | null
          id?: string
          insulation_grade?: string | null
          insulation_total?: number
          job_id?: string
          length?: number | null
          province?: string | null
          quote_file_id?: string | null
          roof_pitch?: number | null
          total_cost?: number
          uploaded_by?: string | null
          weight_lbs?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "steel_cost_entries_quote_file_id_fkey"
            columns: ["quote_file_id"]
            isOneToOne: false
            referencedRelation: "quote_files"
            referencedColumns: ["id"]
          },
        ]
      }
      stored_documents: {
        Row: {
          file_name: string
          file_size: number | null
          file_type: string
          id: string
          job_id: string | null
          parsed_data: Json | null
          parsed_successfully: boolean | null
          project_id: string | null
          storage_path: string
          uploaded_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_type: string
          id?: string
          job_id?: string | null
          parsed_data?: Json | null
          parsed_successfully?: boolean | null
          project_id?: string | null
          storage_path: string
          uploaded_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_type?: string
          id?: string
          job_id?: string | null
          parsed_data?: Json | null
          parsed_successfully?: boolean | null
          project_id?: string | null
          storage_path?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
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
      vendor_bids: {
        Row: {
          amount: number | null
          details: string | null
          id: string
          job_id: string
          lead_time_days: number | null
          status: string | null
          submitted_at: string | null
          vendor_id: string
        }
        Insert: {
          amount?: number | null
          details?: string | null
          id?: string
          job_id: string
          lead_time_days?: number | null
          status?: string | null
          submitted_at?: string | null
          vendor_id: string
        }
        Update: {
          amount?: number | null
          details?: string | null
          id?: string
          job_id?: string
          lead_time_days?: number | null
          status?: string | null
          submitted_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bids_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "vendor_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_jobs: {
        Row: {
          awarded_bid_id: string | null
          category: string
          closing_date: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          job_id: string | null
          required_by_date: string | null
          specifications: Json | null
          status: string | null
          title: string
        }
        Insert: {
          awarded_bid_id?: string | null
          category: string
          closing_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          required_by_date?: string | null
          specifications?: Json | null
          status?: string | null
          title: string
        }
        Update: {
          awarded_bid_id?: string | null
          category?: string
          closing_date?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          required_by_date?: string | null
          specifications?: Json | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_awarded_bid"
            columns: ["awarded_bid_id"]
            isOneToOne: false
            referencedRelation: "vendor_bids"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          contact_email: string
          contact_phone: string
          created_at: string
          id: string
          name: string
          notes: string
          province: string
        }
        Insert: {
          contact_email?: string
          contact_phone?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string
          province?: string
        }
        Update: {
          contact_email?: string
          contact_phone?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string
          province?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_display_info: {
        Args: { user_ids: string[] }
        Returns: {
          display_name: string
          email: string
          id: string
        }[]
      }
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
      is_approved: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "owner"
        | "accounting"
        | "operations"
        | "sales_rep"
        | "freight"
        | "dealer"
        | "manufacturer"
        | "construction"
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
        "dealer",
        "manufacturer",
        "construction",
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
