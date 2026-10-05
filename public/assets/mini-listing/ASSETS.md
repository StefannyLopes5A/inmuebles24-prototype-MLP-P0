# Mini listing assets

Source: Figma file `KcIrcsopqwSQCWp6s8omaI`, mini-listing `518:16845`, inspected 2026-10-05.

| Local asset | Figma node | Intrinsic size |
| --- | --- | --- |
| area.svg | 518:17700 | 20 × 20 |
| bed.svg | 518:17705 | 20 × 20 |
| bath.svg | 518:17710 | 20 × 20 |
| car.svg | 518:17717 | 20 × 20 |
| pets.svg | 518:17723 | 20 × 20 |
| floor.svg | 518:17728 | 20 × 20 |
| mora.svg | 518:17752 | 20 × 20 |
| close.svg | 518:16943 | 24 × 24 |
| premium.svg | 518:17741 | 14.8284 × 16 |

All SVGs are original exports, stored locally and used without editing their paths or intrinsic dimensions. `premium.svg` is retained as the reference export; no catalog record has verified Premium status, so the component does not display that badge. The Figma sample's photographs and agency mark are dynamic listing data, not global decoration. The app keeps each listing's own local photograph and the verified agency association from AGENCY-SOURCES.json.

The catalog currently has one locally available photograph per property. `ListingOverview` keeps the 292 × 290 media area and internal listing action, with a single-photo state. It does not promise the sample's “+32 fotos”. The original source contains six additional image URLs, but their download was denied; no missing image is referenced by the app. Extend `src/listing-details.json` with local, correctly associated files to enable the multiple-photo layout and internal gallery controls.
