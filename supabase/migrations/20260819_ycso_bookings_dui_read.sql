-- Public read of CONFIRMED-DUI YCSO bookings only (JWAZ-16 / Yavapai /bookings).
-- Unclassified (is_dui NULL) and non-DUI rows stay invisible — DUI-only rule.

DROP POLICY IF EXISTS "ycso_bookings_public_read_dui" ON ycso_bookings;
CREATE POLICY "ycso_bookings_public_read_dui"
    ON ycso_bookings FOR SELECT USING (is_dui = true);
