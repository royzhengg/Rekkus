-- B-283: search_restaurants_full_text gained suburb-aware output in 20240223000000.
-- Drop obsolete overloads so typed clients and PostgREST resolve one canonical return shape.

DROP FUNCTION IF EXISTS public.search_restaurants_full_text(text, integer);
DROP FUNCTION IF EXISTS public.search_restaurants_full_text(text, integer, double precision, double precision);
