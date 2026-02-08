export type Profile = {
    id: string
    email: string | null
    full_name: string | null
    avatar_url: string | null
    created_at: string
    updated_at: string
  }
  
  export type Chatbot = {
    id: string
    user_id: string
    name: string
    purpose: string | null
    api_key: string
    created_at: string
    updated_at: string
  }