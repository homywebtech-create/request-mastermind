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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          name_en: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          name_en?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          name_en?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_services: {
        Row: {
          company_id: string
          created_at: string
          id: string
          service_id: string
          sub_service_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          service_id: string
          sub_service_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          service_id?: string
          sub_service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_services_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_services_sub_service_id_fkey"
            columns: ["sub_service_id"]
            isOneToOne: false
            referencedRelation: "sub_services"
            referencedColumns: ["id"]
          },
        ]
      }
      company_user_permissions: {
        Row: {
          company_user_id: string
          created_at: string
          id: string
          permission: Database["public"]["Enums"]["company_permission"]
        }
        Insert: {
          company_user_id: string
          created_at?: string
          id?: string
          permission: Database["public"]["Enums"]["company_permission"]
        }
        Update: {
          company_user_id?: string
          created_at?: string
          id?: string
          permission?: Database["public"]["Enums"]["company_permission"]
        }
        Relationships: [
          {
            foreignKeyName: "company_user_permissions_company_user_id_fkey"
            columns: ["company_user_id"]
            isOneToOne: false
            referencedRelation: "company_users"
            referencedColumns: ["id"]
          },
        ]
      }
      company_users: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          is_owner: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          is_owner?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_owner?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_sub_services: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          sub_service_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          sub_service_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          sub_service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_sub_services_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_sub_services_sub_service_id_fkey"
            columns: ["sub_service_id"]
            isOneToOne: false
            referencedRelation: "sub_services"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          company_id: string | null
          company_logo_url: string | null
          content_ar: string
          content_en: string
          contract_type: string
          created_at: string
          id: string
          is_active: boolean
          rejection_reason: string | null
          sub_service_id: string | null
          terms_ar: string[]
          terms_en: string[]
          title: string
          updated_at: string
        }
        Insert: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          company_logo_url?: string | null
          content_ar: string
          content_en: string
          contract_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          rejection_reason?: string | null
          sub_service_id?: string | null
          terms_ar?: string[]
          terms_en?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string | null
          company_logo_url?: string | null
          content_ar?: string
          content_en?: string
          contract_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          rejection_reason?: string | null
          sub_service_id?: string | null
          terms_ar?: string[]
          terms_en?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_templates_sub_service_id_fkey"
            columns: ["sub_service_id"]
            isOneToOne: false
            referencedRelation: "sub_services"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          area: string | null
          budget: string | null
          budget_type: string | null
          company_id: string | null
          created_at: string
          id: string
          name: string
          whatsapp_number: string
        }
        Insert: {
          area?: string | null
          budget?: string | null
          budget_type?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          name: string
          whatsapp_number: string
        }
        Update: {
          area?: string | null
          budget?: string | null
          budget_type?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          name?: string
          whatsapp_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          company_data: Json
          company_id: string
          created_at: string
          id: string
          reason: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          company_data: Json
          company_id: string
          created_at?: string
          id?: string
          reason: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          company_data?: Json
          company_id?: string
          created_at?: string
          id?: string
          reason?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          app_version: string | null
          created_at: string | null
          device_model: string | null
          device_os: string | null
          device_os_version: string | null
          id: string
          last_used_at: string | null
          platform: string
          specialist_id: string
          token: string
          updated_at: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string | null
          device_model?: string | null
          device_os?: string | null
          device_os_version?: string | null
          id?: string
          last_used_at?: string | null
          platform: string
          specialist_id: string
          token: string
          updated_at?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string | null
          device_model?: string | null
          device_os?: string | null
          device_os_version?: string | null
          id?: string
          last_used_at?: string | null
          platform?: string
          specialist_id?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "device_tokens_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      order_specialists: {
        Row: {
          created_at: string | null
          id: string
          is_accepted: boolean | null
          order_id: string
          quote_notes: string | null
          quoted_at: string | null
          quoted_price: string | null
          rejected_at: string | null
          rejection_reason: string | null
          specialist_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_accepted?: boolean | null
          order_id: string
          quote_notes?: string | null
          quoted_at?: string | null
          quoted_price?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          specialist_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_accepted?: boolean | null
          order_id?: string
          quote_notes?: string | null
          quoted_at?: string | null
          quoted_price?: string | null
          rejected_at?: string | null
          rejection_reason?: string | null
          specialist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_specialists_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_specialists_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          booking_date: string | null
          booking_date_type: string | null
          booking_time: string | null
          booking_type: string | null
          building_info: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          customer_rating: number | null
          customer_review_notes: string | null
          expires_at: string | null
          gps_latitude: number | null
          gps_longitude: number | null
          hours_count: string | null
          id: string
          last_sent_at: string | null
          link_copied_at: string | null
          modified_by: string | null
          notes: string | null
          notified_expiry: boolean | null
          order_link: string | null
          order_number: string | null
          selected_booking_type: string | null
          send_to_all_companies: boolean
          service_type: string
          specialist_id: string | null
          status: string
          tracking_stage: string | null
          updated_at: string
        }
        Insert: {
          booking_date?: string | null
          booking_date_type?: string | null
          booking_time?: string | null
          booking_type?: string | null
          building_info?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_rating?: number | null
          customer_review_notes?: string | null
          expires_at?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          hours_count?: string | null
          id?: string
          last_sent_at?: string | null
          link_copied_at?: string | null
          modified_by?: string | null
          notes?: string | null
          notified_expiry?: boolean | null
          order_link?: string | null
          order_number?: string | null
          selected_booking_type?: string | null
          send_to_all_companies?: boolean
          service_type: string
          specialist_id?: string | null
          status?: string
          tracking_stage?: string | null
          updated_at?: string
        }
        Update: {
          booking_date?: string | null
          booking_date_type?: string | null
          booking_time?: string | null
          booking_type?: string | null
          building_info?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_rating?: number | null
          customer_review_notes?: string | null
          expires_at?: string | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          hours_count?: string | null
          id?: string
          last_sent_at?: string | null
          link_copied_at?: string | null
          modified_by?: string | null
          notes?: string | null
          notified_expiry?: boolean | null
          order_link?: string | null
          order_number?: string | null
          selected_booking_type?: string | null
          send_to_all_companies?: boolean
          service_type?: string
          specialist_id?: string | null
          status?: string
          tracking_stage?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          price: number | null
          pricing_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          price?: number | null
          pricing_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          price?: number | null
          pricing_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      specialist_reviews: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          order_id: string
          rating: number
          review_text: string | null
          specialist_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          order_id: string
          rating: number
          review_text?: string | null
          specialist_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string
          rating?: number
          review_text?: string | null
          specialist_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialist_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialist_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialist_reviews_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      specialist_schedules: {
        Row: {
          created_at: string | null
          end_time: string
          id: string
          order_id: string
          specialist_id: string
          start_time: string
          travel_buffer_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_time: string
          id?: string
          order_id: string
          specialist_id: string
          start_time: string
          travel_buffer_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string
          id?: string
          order_id?: string
          specialist_id?: string
          start_time?: string
          travel_buffer_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "specialist_schedules_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialist_schedules_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
        ]
      }
      specialist_specialties: {
        Row: {
          created_at: string
          id: string
          specialist_id: string
          sub_service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          specialist_id: string
          sub_service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          specialist_id?: string
          sub_service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialist_specialties_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "specialists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specialist_specialties_sub_service_id_fkey"
            columns: ["sub_service_id"]
            isOneToOne: false
            referencedRelation: "sub_services"
            referencedColumns: ["id"]
          },
        ]
      }
      specialists: {
        Row: {
          approval_status: string | null
          company_id: string
          countries_worked_in: string[] | null
          created_at: string
          experience_years: number | null
          face_photo_url: string | null
          full_body_photo_url: string | null
          has_cleaning_allergy: boolean | null
          has_pet_allergy: boolean | null
          id: string
          id_card_back_url: string | null
          id_card_expiry_date: string | null
          id_card_front_url: string | null
          image_url: string | null
          is_active: boolean
          languages_spoken: string[] | null
          name: string
          nationality: string | null
          notes: string | null
          phone: string
          rating: number | null
          registration_completed_at: string | null
          registration_token: string | null
          reviews_count: number | null
          specialty: string | null
          suspension_end_date: string | null
          suspension_reason: string | null
          suspension_type: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string | null
          company_id: string
          countries_worked_in?: string[] | null
          created_at?: string
          experience_years?: number | null
          face_photo_url?: string | null
          full_body_photo_url?: string | null
          has_cleaning_allergy?: boolean | null
          has_pet_allergy?: boolean | null
          id?: string
          id_card_back_url?: string | null
          id_card_expiry_date?: string | null
          id_card_front_url?: string | null
          image_url?: string | null
          is_active?: boolean
          languages_spoken?: string[] | null
          name: string
          nationality?: string | null
          notes?: string | null
          phone: string
          rating?: number | null
          registration_completed_at?: string | null
          registration_token?: string | null
          reviews_count?: number | null
          specialty?: string | null
          suspension_end_date?: string | null
          suspension_reason?: string | null
          suspension_type?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string | null
          company_id?: string
          countries_worked_in?: string[] | null
          created_at?: string
          experience_years?: number | null
          face_photo_url?: string | null
          full_body_photo_url?: string | null
          has_cleaning_allergy?: boolean | null
          has_pet_allergy?: boolean | null
          id?: string
          id_card_back_url?: string | null
          id_card_expiry_date?: string | null
          id_card_front_url?: string | null
          image_url?: string | null
          is_active?: boolean
          languages_spoken?: string[] | null
          name?: string
          nationality?: string | null
          notes?: string | null
          phone?: string
          rating?: number | null
          registration_completed_at?: string | null
          registration_token?: string | null
          reviews_count?: number | null
          specialty?: string | null
          suspension_end_date?: string | null
          suspension_reason?: string | null
          suspension_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          name_en: string | null
          price: number | null
          pricing_type: string | null
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_en?: string | null
          price?: number | null
          pricing_type?: string | null
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_en?: string | null
          price?: number | null
          pricing_type?: string | null
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sub_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission?: string
          user_id?: string
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
      verification_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_expired_id_cards: { Args: never; Returns: undefined }
      check_verification_rate_limit: {
        Args: { phone_number: string }
        Returns: boolean
      }
      cleanup_expired_verification_codes: { Args: never; Returns: undefined }
      generate_order_number: { Args: never; Returns: string }
      generate_specialist_registration_token: { Args: never; Returns: string }
      get_next_available_time: {
        Args: { _duration_hours?: number; _specialist_id: string }
        Returns: string
      }
      has_company_permission: {
        Args: {
          _company_id: string
          _permission: Database["public"]["Enums"]["company_permission"]
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
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_company_member: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
      is_specialist_available: {
        Args: { _end_time: string; _specialist_id: string; _start_time: string }
        Returns: boolean
      }
      log_activity: {
        Args: {
          _action_type: string
          _details?: Json
          _resource_id?: string
          _resource_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "specialist"
        | "admin_full"
        | "admin_viewer"
        | "admin_manager"
      company_permission:
        | "manage_specialists"
        | "view_specialists"
        | "manage_orders"
        | "view_orders"
        | "manage_contracts"
        | "view_contracts"
        | "manage_team"
        | "view_reports"
      order_status:
        | "pending"
        | "quoted"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
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
        "specialist",
        "admin_full",
        "admin_viewer",
        "admin_manager",
      ],
      company_permission: [
        "manage_specialists",
        "view_specialists",
        "manage_orders",
        "view_orders",
        "manage_contracts",
        "view_contracts",
        "manage_team",
        "view_reports",
      ],
      order_status: [
        "pending",
        "quoted",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
