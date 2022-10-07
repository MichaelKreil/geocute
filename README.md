# GeoCUTE
**Geo** **C**onversion **U**sing **T**elephone book **E**ntries

## Installation

```
git clone git@github.com:MichaelKreil/geocute.git
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
  - `../data/deutschland_berlin_blk.bin.br`: Combined `berlin_blk.bin` for Berlin and `deutschland.bin` for all other states.
- `output`: filename of resulting TSV file

## Example
If you want to calculate a matrix for converting from "gemeinden" to "wahlkreise", use:

`node geocute gemeinden.geojson AGS wahlkreise.geojson wkr_nr matrix.tsv`

## How it works

Many data have a spatial reference, e.g. unemployment statistics at municipality level, election results by constituency or insolvencies by postcode. If two databases have different spatial references, it is very difficult to combine them.

Let's take the two spatial references unemployment figures by municipality and insolvencies by postcode area as an example: Postcodes can contain several municipalities and municipalities can consist of several postcode areas. This makes a conversion and thus a comparison of these statistics very difficult. Furthermore, it is not sufficient to calculate the overlapping area between postcode areas and municipalities, as a large wooded area with no inhabitants is certainly not as relevant to unemployment rates/insolvencies as a small settlement with a high population density.

This is exactly where GeoCUTE comes in:
GeoCUTE contains a database with the addresses of telephone subscribers as geo-coordinates (in Germany, as of sometime between 2010 ~ 2015). The first step for each of these geo-coordinates is to calculate in which postcode area or municipality they are located. If there are 1000 of these coordinates in postcode area X, and 300 of these 1000 are also in municipality Y, then GeoCUTE assumes that 30% of the insolvencies in postcode area X fall in municipality Y.

GeoCUTE therefore calculates for each known address point in which region of spatial reference A and in which region of spatial reference B the point is located, and can use this to calculate a conversion matrix to convert from spatial reference A to spatial reference B.
