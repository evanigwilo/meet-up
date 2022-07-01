// 👇 ensures that all necessary environment variables are defined after reading from .env
import dotenv from 'dotenv-safe';
dotenv.config({ allowEmptyValues: true });

// 👇 this package is used to parse decorators for building sql queries.
import 'reflect-metadata';
