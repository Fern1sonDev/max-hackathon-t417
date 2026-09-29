export interface Audience {
  title: string;
  channel: string;
  image: string;
  bg: string;
  description: string;
  points: string[];
}

export const AUDIENCES: Audience[] = [
  {
    title: "Студентам",
    channel: "Мини-приложение + бот в MAX",
    image: "/illustrations/student-boy.webp",
    bg: "bg-gradient-to-b from-blue-100 to-blue-50",
    description: "Стажировки, где понятно, почему ты подходишь, — и ответ компании в том же мессенджере.",
    points: ["Индекс соответствия и чего не хватает до 100%", "Отклик в один тап и задание в чате", "Публичная визитка и сертификаты навыков"],
  },
  {
    title: "Кураторам вузов",
    channel: "Веб-кабинет",
    image: "/illustrations/curator.webp",
    bg: "bg-gradient-to-b from-violet-100 to-violet-50",
    description: "Помогайте группе выйти на практику и видьте, кому нужна помощь, до отчётной недели.",
    points: ["Группы с QR-кодом и своей ссылкой", "Пакетная проверка навыков: 3 решения и комментарий", "Тесты вместе с работодателями и аналитика региона"],
  },
  {
    title: "Работодателям",
    channel: "Веб-кабинет",
    image: "/illustrations/employer.webp",
    bg: "bg-gradient-to-b from-sky-100 to-sky-50",
    description: "Стажёры с навыками, за которые поручился вуз, и отклики, уже отсортированные по совпадению.",
    points: ["Воронка по каждой стажировке и телефон кандидата", "Приглашение со следующим шагом и отмена за 90 секунд", "Команда рекрутеров и интеграции с ATS"],
  },
];
