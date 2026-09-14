from pydantic import BaseModel, EmailStr, Field


class LoginUsuarioIn(BaseModel):
    codigo: str = Field(min_length=1, max_length=15)
    password: str = Field(min_length=1)


class LoginTrabajadorIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class ForgotPasswordIn(BaseModel):
    identifier: str = Field(min_length=1)


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=1)
    newPassword: str = Field(min_length=6)


class PublicUser(BaseModel):
    id: int
    nombre: str
    rol: str
    tipo: str
    codigo: str | None = None
    email: str | None = None


class LoginResult(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    user: PublicUser
