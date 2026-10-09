# Asset Composer

Локальный редактор персонажей, экипировки, окружения и самостоятельных рисунков.

В репозиторий включены исходные атласы чиби, отдельные модули, листы анимаций, редактируемый проект и полный ZIP-пак. Для архива используется Git LFS: после клонирования выполните `git lfs install` и `git lfs pull`. Остальные исходные изображения доступны обычными файлами Git.

- [Чиби-пак: состав и использование](public/asset-packs/chibi-tokens-v1/README.ru.md)
- [Возраст, профессии и действия](docs/chibi-ages-and-work.ru.md)
- [Перенос в Godot / Planetki и снабжение предметами](docs/planetki-export-guide.ru.md)
- [Три дерева со стадиями рубки](public/asset-packs/composer-trees-v1/README.ru.md)

- [Руководство пользователя](docs/user-guide.ru.md)
- [Частые вопросы](docs/faq.ru.md)
- [Устройство нового интерфейса и результаты проверки](docs/interface-redesign.md)

Справка доступна без интернета через «Инструкция и FAQ» и F1. Основные рабочие разделы зависят от открытого объекта.

## Разработка

Из корня репозитория:

```sh
pnpm --filter @workspace/asset-composer dev
pnpm --filter @workspace/asset-composer typecheck
pnpm --filter @workspace/asset-composer test:run --maxWorkers=2 --testTimeout=30000
pnpm --filter @workspace/asset-composer build
```

Тексты встроенной справки находятся в `src/data/helpContent.ts`. После изменения текстов обновите Markdown:

```sh
pnpm --filter @workspace/asset-composer docs:help
```

«Сохранить» подготавливает переносимый JSON, а в Electron со связанной папкой записывает проект в эту папку. Автосохранение обновляет локальную копию в IndexedDB. «Экспортировать» создаёт изображения и данные текущего объекта; предмет экспортируется вместе с выбранным персонажем.
