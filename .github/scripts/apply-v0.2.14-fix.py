from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FILES = [
    ROOT / "VidCoreNativePlayer/assets/metadata.js",
    ROOT / "VidCoreWebPlayer/metadata.js",
]

OLD = '''  function mergeWikidataEntity(entry, metadata, entity) {
    if (!entity || entity.missing !== undefined) return metadata;

    const posterName = entity?.claims?.P3383?.[0]?.mainsnak?.datavalue?.value || "";
    const logoName = entity?.claims?.P154?.[0]?.mainsnak?.datavalue?.value || "";
    const imageName = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value || "";
    const articleName = entity?.sitelinks?.enwiki?.title || "";
    const article = articleName
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(articleName.replaceAll(" ", "_"))}`
      : "";

    return {
      ...metadata,
      title: isGenericTitle(entry, metadata.title)
        ? entity?.labels?.en?.value || metadata.title
        : metadata.title,
      description:
        metadata.description ||
        entity?.descriptions?.en?.value ||
        "",
      image: isLikelyBadArtwork(entry, metadata, metadata.image)
        ? selectArtworkImage(entry, metadata, [
            { kind: "poster", value: commonsImageUrl(posterName) },
            { kind: "logo", value: commonsImageUrl(logoName) },
            { kind: "image", value: commonsImageUrl(imageName) }
          ])
        : metadata.image || selectArtworkImage(entry, metadata, [
            { kind: "poster", value: commonsImageUrl(posterName) },
            { kind: "logo", value: commonsImageUrl(logoName) },
            { kind: "image", value: commonsImageUrl(imageName) }
          ]),
      article: metadata.article || article,
      wikidata:
        metadata.wikidata ||
        (entity.id ? `https://www.wikidata.org/entity/${entity.id}` : ""),
      resolutionStatus: entity.id ? "resolved" : metadata.resolutionStatus,
      resolvedAt: new Date().toISOString()
    };
  }
'''

NEW = '''  function mergeWikidataEntity(entry, metadata, entity) {
    if (!entity || entity.missing !== undefined) return metadata;

    const posterName = entity?.claims?.P3383?.[0]?.mainsnak?.datavalue?.value || "";
    const logoName = entity?.claims?.P154?.[0]?.mainsnak?.datavalue?.value || "";
    const imageName = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value || "";
    const articleName = entity?.sitelinks?.enwiki?.title || "";
    const article = articleName
      ? `https://en.wikipedia.org/wiki/${encodeURIComponent(articleName.replaceAll(" ", "_"))}`
      : "";
    const resolvedTitle = isGenericTitle(entry, metadata.title)
      ? entity?.labels?.en?.value || metadata.title
      : metadata.title;
    const resolvedDescription =
      metadata.description ||
      entity?.descriptions?.en?.value ||
      "";
    const artworkMetadata = {
      ...metadata,
      title: resolvedTitle,
      description: resolvedDescription
    };
    const candidates = [
      { kind: "poster", value: commonsImageUrl(posterName) },
      { kind: "logo", value: commonsImageUrl(logoName) },
      { kind: "image", value: commonsImageUrl(imageName) }
    ];
    const retainedImage = metadata.image &&
      !isLikelyBadArtwork(entry, artworkMetadata, metadata.image)
        ? metadata.image
        : "";

    return {
      ...metadata,
      title: resolvedTitle,
      description: resolvedDescription,
      image: retainedImage || selectArtworkImage(entry, artworkMetadata, candidates),
      article: metadata.article || article,
      wikidata:
        metadata.wikidata ||
        (entity.id ? `https://www.wikidata.org/entity/${entity.id}` : ""),
      resolutionStatus: entity.id ? "resolved" : metadata.resolutionStatus,
      resolvedAt: new Date().toISOString()
    };
  }
'''

for path in FILES:
    text = path.read_text(encoding="utf-8")
    if OLD not in text:
        raise RuntimeError(f"Expected mergeWikidataEntity block was not found in {path}")
    path.write_text(text.replace(OLD, NEW, 1), encoding="utf-8")

if FILES[0].read_text(encoding="utf-8") != FILES[1].read_text(encoding="utf-8"):
    raise RuntimeError("Native and Web metadata implementations diverged.")

mission = ROOT / "missioncache.md"
text = mission.read_text(encoding="utf-8")
anchor = "- [x] Tighten artwork acceptance around sequel numbers, conflicting years, article media type, book/title-page imagery, historical source material, soundtrack/album art, and unrelated posters.\n"
addition = anchor + "- [x] Resolve an exact Wikidata entity's title before validating its artwork so valid title-matching posters are not compared against generic Movie/TV ID placeholders.\n"
if addition not in text:
    if anchor not in text:
        raise RuntimeError("Mission-cache artwork anchor was not found.")
    text = text.replace(anchor, addition, 1)
mission.write_text(text, encoding="utf-8")
