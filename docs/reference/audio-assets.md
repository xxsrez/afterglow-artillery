# Происхождение аудио-ассетов

- **Статус:** справочно; реестр файлов, лицензий и преобразований
- **Проверено:** 2026-07-28
- **Область:** музыка и sample-based SFX в `public/audio/`

## 1. Граница использования

Все перечисленные ниже файлы получены из сторонних пакетов с лицензией
[Creative Commons Zero 1.0](https://creativecommons.org/publicdomain/zero/1.0/)
(`CC0-1.0`). Ни один из них не взят из Scorched Earth, его архива или
исполняемых файлов.

CC0 не требует атрибуции, однако проект добровольно сохраняет имена авторов и
ссылки на первичные страницы. Этот реестр фиксирует проверенные download и
локальные преобразования, но не является юридическим заключением.

## 2. Первичные источники

| Набор | Автор / издатель | Первичная страница | Проверенное свидетельство |
|---|---|---|---|
| `5 Chiptunes (Action)` | Juhani Junkala (`SubspaceAudio`) | [OpenGameArt](https://opengameart.org/content/5-chiptunes-action) | Страница помечает набор как CC0 и сообщает, что пять tracks сделаны seamless-looping; вложенный `INFO.txt` также прямо указывает CC0 |
| `Sci-fi Sounds 1.0` | Kenney | [Kenney](https://kenney.nl/assets/sci-fi-sounds) | Страница указывает `Creative Commons CC0`; вложенный `License.txt` указывает CC0 и разрешает personal, educational и commercial use |
| `Impact Sounds 1.0` | Kenney | [Kenney](https://kenney.nl/assets/impact-sounds) | Страница указывает `Creative Commons CC0`; вложенный `License.txt` указывает CC0 и разрешает personal, educational и commercial use |

Проверенные download зафиксированы по SHA-256:

| Download со страницы | Служебное имя при проверке | SHA-256 |
|---|---|---|
| `5 Action Chiptunes By Juhani Junkala.zip` | `juhani-action.zip` | `ea189990c0fb9a700187ccc740eda72400341a082305a163867467d96346460d` |
| `Impact Sounds 1.0` archive | `kenney-impact.zip` | `029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8` |
| `Sci-fi Sounds 1.0` archive | `kenney-scifi.zip` | `119340f351a5098ad814f78719438c0da355a9ce8a4c8a3af6a8d48aa3d49e04` |

Служебные имена относятся только к локальной проверке и не входят в
публичный bundle.

## 3. Музыка

Исходник
`Juhani Junkala [Retro Game Music Pack] Level 1.wav` из
`5 Chiptunes (Action)` с SHA-256
`6f79ae4c6f2b59baa62c46bcd264c9d157f5dca2c30845fabc3c5be4e2b64a43`
преобразован в
`public/audio/afterglow-action-loop-v1.mp3`.

Преобразование:

- сохранены полная длительность `74.254 s`, stereo и sample rate `44.1 kHz`;
- EBU R128 loudness normalisation выполнена с целью `-14 LUFS` и ограничением
  true peak не выше `-1 dBTP`;
- результат закодирован `libmp3lame` с bitrate около `160 kbit/s`;
- trim и fade не применялись; записан Xing/LAME header, чтобы сохранить
  информацию об encoder delay настолько, насколько это позволяет MP3;
- инструментальная проверка результата дала `-14.4 LUFS integrated` и
  `-5.3 dBTP`; бесшовность перехода всё ещё требует listening test в каждом
  целевом browser, потому что поведение loop зависит от decoder.

| Публичный файл | Codec / layout | SHA-256 |
|---|---|---|
| `afterglow-action-loop-v1.mp3` | MP3, stereo, `44.1 kHz`, `160 kbit/s` | `0593642fec9f9afab2627efb90a79408d64c0891db671d17bc5f4aac886d3963` |

## 4. Sound effects

Общее преобразование для SFX: исходный Ogg Vorbis декодирован через FFmpeg,
при необходимости сведён в mono, resampled в `32 kHz` и записан как
uncompressed little-endian PCM16 WAV. Нормализация, denoise и динамическая
компрессия не применялись. Это оставляет дальнейшие gain, filtering и layering
за runtime mixer.

| Публичный файл | Набор | Исходное имя | SHA-256 исходника | Дополнительное преобразование | SHA-256 результата |
|---|---|---|---|---|---|
| `blast-small.wav` | Sci-fi Sounds | `explosionCrunch_000.ogg` | `4b597d658d0ae101f0a030fbeea5fc3a4292ab85f017470a8254a8e7959cbd69` | без trim | `20a1ea0f53e88e7ccde18f6d35313b2c908321b31484d5b1e55cf3bd6310545d` |
| `blast-medium.wav` | Sci-fi Sounds | `explosionCrunch_002.ogg` | `be2b8ddc62e4a24c91e2e77793de98549ce216faf2f323a917e7d6f34321ff97` | без trim | `9f8861240fae9c028db3bddff9705f6195129928b475f2345e3e280aaefd10e4` |
| `blast-large.wav` | Sci-fi Sounds | `explosionCrunch_004.ogg` | `9c3a1c73cadf0de5d5a578b31a264f20b1ac7cb6ec9bbd34a203f58402ea5390` | без trim | `75c76b033fd53bc61a79cff20fc1b9b5375da2114eabe2388e193fd35074007e` |
| `blast-low.wav` | Sci-fi Sounds | `lowFrequency_explosion_000.ogg` | `3cb48d86dab63140cfb9aaeea4d4a6846abaca5831d157d8adbec0490da26343` | stereo → mono, без trim | `f5141cf28e5d237d5dcd1fbc530a3ed6c96af403ec8429d0a20dd7592c7e5231` |
| `impact-soil.wav` | Impact Sounds | `impactSoft_heavy_001.ogg` | `4d0096364ba9e46119d2ff6df493fdc101bd2e1efae061da5e5f77a53b3fdcb6` | stereo → mono, без trim | `d2d34aba825cc2c8a155a18e4f5a3087145aac8e1fd27d8b5f77810ac435062f` |
| `impact-rock.wav` | Impact Sounds | `impactMining_003.ogg` | `4237fa2cd80364ad81cd0af44f67d7497f1c5edcc7bdb02cd22be2ba4580c83d` | stereo → mono, без trim | `80637e51cd676497c3566640a5abd6964e5b4d22b2884fe6fd124113dc4fbecb` |
| `impact-hull.wav` | Impact Sounds | `impactMetal_heavy_001.ogg` | `83554049f81f4db9209379e103c30bfa63f65c42189a03f300b045c2c82e23ae` | stereo → mono, без trim | `ab086edbe55eb55446c1121d398d3ab1762026cc0114792f902ff0c95d147af7` |
| `shield-field.wav` | Sci-fi Sounds | `forceField_003.ogg` | `15e3fe971ffd3415e5ab641d3a4d043fb31f6712b0956315b524ba29c3889cda` | без trim | `71a0af00f6cbc6b8d8af3cdbc37cdcb171d69f4ccb559f9176118eeca4817c30` |
| `laser-small.wav` | Sci-fi Sounds | `laserSmall_002.ogg` | `e70139466c3e801358c9041ee17db7ff82c0e9a9cdf44647ad0ea6b9f8458f63` | stereo → mono, без trim | `7c94e63954787666251f7156862757c47af93b2dd7e94ae8f0c5a4b4e4c9ee32` |
| `laser-large.wav` | Sci-fi Sounds | `laserLarge_004.ogg` | `86c749483b40e1bba9bfea6a04e884d479e5481e52efb6f113341141de516b3b` | без trim | `bf2e46de6007cd1ca4343a0dfc05be953cea796c17569e421ef277817434a253` |
| `launch-thruster.wav` | Sci-fi Sounds | `thrusterFire_002.ogg` | `5f7731c30196d73777d62eec7cb36a28bf63852e70244057b7625b888e71a3a8` | первые `0.75 s`; fade-out `0.58–0.75 s` | `ed935c4da3accb0b815c7ff09bd701cbab0ed22707522cbe352e102a6eca47de` |
| `fire-whoosh.wav` | Sci-fi Sounds | `thrusterFire_004.ogg` | `5297afd01c3e91a13d08ec1f673d89997bd17012fa8645a20c94fba240f0f1b2` | первые `1.40 s`; fade-out `1.10–1.40 s` | `cc9527360bed06eca787c83538ee892d9484c8bc09c21a537a02c779c90fdd2d` |

## 5. Добровольные credits

При публикации credits можно использовать:

> Music: “Level 1” from “5 Chiptunes (Action)” by Juhani Junkala /
> SubspaceAudio, CC0 1.0. Sound effects: “Sci-fi Sounds” and “Impact Sounds”
> by Kenney, CC0 1.0.

Ссылки в credit ведут на первичные страницы из раздела 2. Attribution
добровольна, но сам реестр происхождения должен сохраняться вместе с
ассетами.
