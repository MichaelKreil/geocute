# GeoCUTE
**Geo** **C**onversion **U**sing **T**elephone book **E**ntries

## Installation

```
git clone git@git.dsst.io:btw17/geocute.git
cd geocute
npm install
npm link
```

## Usage

`geocute geo1 key1 geo2 key2 [pointlist] output`
  
- `geo1`: filename of source GeoJSON
- `key1`: property name of the key in source GeoJSON
- `geo2`: filename of target GeoJSON
- `key2`: property name of the key in target GeoJSON
- `pointlist`: (optional) name of list of points to through at the data. Can be:
  - `../data/deutschland.bin.br`: (default) based on telephone book entries (?)
  - `../data/deutschland-only.bin.br`: based on 2011 zensus data and ldbv adress coordinates (2011)
  - `../data/berlin_blk.bin.br`: Berlin only, based on "statistische Blöcke" (2019)
  - `../data/berlin_adr_ew.bin.br`: Berlin only, based on "Sonderauswertung RBS-Adressen" (2016)
- `output`: filename of resulting TSV file

## Example
If you want to calculate a matrix for converting from "gemeinden" to "wahlkreise", use:

`node geocute gemeinden.geojson AGS wahlkreise.geojson wkr_nr matrix.tsv`