export interface Account {
  id: string
  name: string
  email: string
}

export interface CartMerge {
  moved: number
  omitted: number
  couponNotice?: string
}

export interface Session {
  user: Account
  expiresAt: string
  merge: CartMerge
}

export interface AuthResult extends Session {
  token: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput extends LoginInput {
  name: string
  termsAccepted: boolean
}
