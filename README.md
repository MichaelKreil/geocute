# GeoCUTE
**Geo** **C**onversion **U**sing **T**elephone book **E**ntries

## Installation

```
git clone git@git.dsst.io:wahl/geocute.git
cd geocute
npm install
npm link
```

## Usage

`cutematrix geo1 key1 geo2 key2 output`
  
- `geo1`: filename of source GeoJSON
- `key1`: property name of the key in source GeoJSON
- `geo2`: filename of target GeoJSON
- `key2`: property name of the key in target GeoJSON
- `output`: filename of resulting TSV file

## Example
If you want to calculate a matrix for converting from "gemeinden" to "wahlkreise", use:

`cutematrix gemeinden.geojson AGS wahlkreise.geojson wkr_nr matrix.tsv`