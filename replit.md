# 10HourAi - Real Estate Wholesaling Assistant

## Overview

10HourAi is a comprehensive real estate wholesaling platform that leverages AI agents to assist with lead generation, deal analysis, negotiation, and closing processes. The application provides a complete CRM system, deal pipeline management, document handling, and integrated AI chat interfaces to streamline real estate wholesaling operations.

The platform features multiple specialized AI agents (Lead Finder, Deal Analyzer, Negotiation, and Closing agents) that work together to help users identify distressed properties, analyze deals, negotiate with sellers, and manage the closing process.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack React Query for server state management
- **Routing**: Wouter for client-side routing
- **Component Structure**: Modular component architecture with separate directories for UI components, layout, business logic (CRM, chat, pipeline, etc.)

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with dedicated routes for properties, contacts, conversations, messages, documents, and deals
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Schema Validation**: Zod schemas for runtime type validation
- **Development Setup**: Hot reload with Vite integration in development mode

### Data Storage Solutions
- **Database**: PostgreSQL as the primary database
- **Connection**: Neon Database serverless PostgreSQL service
- **Schema Management**: Drizzle migrations with schema defined in shared/schema.ts
- **Data Models**: Comprehensive schema including users, properties, contacts, conversations, messages, documents, and deals with proper relationships

### Authentication and Authorization
- **Session Management**: PostgreSQL-based session storage using connect-pg-simple
- **User Model**: Simple username/password authentication system
- **Security**: Prepared for authentication middleware integration

### AI Integration Architecture
- **AI Provider**: OpenAI GPT-4o integration
- **Agent Types**: Four specialized agents (Lead Finder, Deal Analyzer, Negotiation, Closing)
- **Context Management**: Property and contact data integration with AI responses
- **Conversation Tracking**: Persistent conversation history with agent type association
- **Live Data Integration**: BatchData API provides real-time property data, valuations, and owner information to AI agents

### Data Quality Assurance
- **Property Validation**: Filters out properties with missing pricing or undefined equity percentages
- **Quality Metrics**: Tracks data completeness rates across different markets (typically 95-100% for most areas)
- **Authentic Data Only**: All property information sourced from live BatchData API with verified owner names and contact details

### Application Modules

#### CRM System
- Property management with search and filtering capabilities
- Contact management linked to properties
- Lead tracking with status progression (new, contacted, qualified, under_contract, closed)
- Property details including ARV, bedrooms, bathrooms, square footage

#### Deal Pipeline
- Kanban-style deal management across stages (lead_generation, analysis, negotiation, closing)
- Deal value tracking and metrics calculation
- Progress monitoring and conversion rate analysis

#### Document Management
- Document categorization (purchase agreements, assignment contracts, closing documents, templates)
- Property-linked document organization
- Document status tracking (draft, pending, signed, completed)

#### Chat Interface
- Multi-agent conversation system
- Real-time message exchange with AI agents
- Context-aware responses based on selected properties and contacts
- Conversation history and thread management
- Seller Lead Wizard: 4-step guided property search (first of 3 planned Lead Finder wizards)
  - Step 1: Location targeting (city/ZIP, state selection)
  - Step 2: Seller type filtering (distressed, absentee, high equity, etc.)
  - Step 3: Property type selection (single-family, multi-family, condos, etc.)
  - Step 4: Advanced filters (bedrooms, price range)
- Future wizards planned: Cash Buyer Wizard, Market Research Wizard

**Current Status (August 2025):**
- ✅ Price filtering enforcement working correctly (properties respect specified limits)
- ✅ Comprehensive data format implemented with full BatchLeads API integration
- ✅ Real mailing addresses from different states displaying correctly
- ✅ Max offer calculations using 70% rule working
- ⚠️ Property cards show mixed results - some display full data, others show blanks due to cached vs. fresh response formatting differences
- 🔧 Property cards kept as-is per user request while investigating response consistency

#### Dashboard and Analytics
- Revenue tracking and deal metrics
- Performance analytics with conversion rates
- Pipeline value calculations and forecasting

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: Serverless PostgreSQL database connection
- **drizzle-orm**: Type-safe database operations and query building
- **@tanstack/react-query**: Server state management and caching
- **openai**: AI integration for chat agents and property analysis
- **BatchData API**: Live real estate data integration with property valuations, owner information, and equity calculations

### UI and Styling
- **@radix-ui/react-***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### Development Tools
- **vite**: Fast build tool and development server
- **typescript**: Type safety and development experience
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Fast JavaScript bundler for production builds

### Form and Data Handling
- **react-hook-form**: Form state management
- **@hookform/resolvers**: Form validation resolvers
- **zod**: Runtime type validation and schema definition
- **date-fns**: Date manipulation and formatting

### Additional Integrations
- **wouter**: Lightweight routing for React
- **cmdk**: Command menu component
- **embla-carousel-react**: Carousel/slider component
- **react-day-picker**: Date picker component