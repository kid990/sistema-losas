from pydantic import BaseModel, EmailStr, Field


class TrabajadorCreate(BaseModel):
    dni: str = Field(min_length=8, max_length=8)
    nombres: str = Field(min_length=1, max_length=30)
    apellidos: str = Field(min_length=1, max_length=61)
    rol: str
    email: EmailStr
    password: str = Field(min_length=4)
    telefono: str | None = Field(default=None, max_length=15)


class TrabajadorUpdate(BaseModel):
    nombres: str = Field(min_length=1, max_length=30)
    apellidos: str = Field(min_length=1, max_length=61)
    rol: str
    telefono: str | None = Field(default=None, max_length=15)


class PasswordChange(BaseModel):
    actualPassword: str = Field(min_length=1)
    nuevaPassword: str = Field(min_length=4)
