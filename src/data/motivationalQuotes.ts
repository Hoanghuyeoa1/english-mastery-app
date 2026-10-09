export type QuoteCategory = 'learning' | 'discipline' | 'language' | 'persistence' | 'growth' | 'mindset';

export interface MotivationalQuote {
  id: number;
  en: string;
  vi: string;
  author: string;
  category?: QuoteCategory;
}

export const MOTIVATIONAL_QUOTES: MotivationalQuote[] = [
  {
    id: 1,
    en: "The secret of getting ahead is getting started.",
    vi: "Bí quyết để bứt phá và tiến xa là hãy bắt đầu ngay từ hôm nay.",
    author: "Mark Twain",
    category: "growth"
  },
  {
    id: 2,
    en: "Small daily improvements over time lead to stunning results.",
    vi: "Những tiến bộ nhỏ mỗi ngày theo thời gian sẽ tạo nên kết quả phi thường.",
    author: "Robin Sharma",
    category: "discipline"
  },
  {
    id: 3,
    en: "To have another language is to possess a second soul.",
    vi: "Sở hữu một ngôn ngữ mới là bạn đang nắm giữ một tâm hồn thứ hai.",
    author: "Charlemagne",
    category: "language"
  },
  {
    id: 4,
    en: "An investment in knowledge pays the best interest.",
    vi: "Đầu tư vào tri thức luôn mang lại mức lợi nhuận cao nhất.",
    author: "Benjamin Franklin",
    category: "learning"
  },
  {
    id: 5,
    en: "Continuous learning is the minimum requirement for success in any field.",
    vi: "Học hỏi không ngừng là yêu cầu tối thiểu để chạm tới thành công trong mọi lĩnh vực.",
    author: "Brian Tracy",
    category: "learning"
  },
  {
    id: 6,
    en: "One language sets you in a corridor for life. Two languages open every door along the way.",
    vi: "Một ngôn ngữ đưa bạn vào hành lang cuộc sống. Hai ngôn ngữ mở ra mọi cánh cửa trên hành trình đó.",
    author: "Frank Smith",
    category: "language"
  },
  {
    id: 7,
    en: "You do not have to be great to start, but you have to start to be great.",
    vi: "Bạn không cần phải xuất sắc để bắt đầu, nhưng bạn phải bắt đầu để trở nên xuất sắc.",
    author: "Zig Ziglar",
    category: "growth"
  },
  {
    id: 8,
    en: "Discipline is the bridge between goals and accomplishment.",
    vi: "Kỷ luật là chiếc cầu nối vững chắc giữa mục tiêu và thành tựu.",
    author: "Jim Rohn",
    category: "discipline"
  },
  {
    id: 9,
    en: "Live as if you were to die tomorrow. Learn as if you were to live forever.",
    vi: "Hãy sống như thể ngày mai bạn sẽ ra đi. Hãy học như thể bạn sẽ sống mãi mãi.",
    author: "Mahatma Gandhi",
    category: "learning"
  },
  {
    id: 10,
    en: "The limits of my language mean the limits of my world.",
    vi: "Giới hạn ngôn ngữ của tôi chính là giới hạn thế giới của tôi.",
    author: "Ludwig Wittgenstein",
    category: "language"
  },
  {
    id: 11,
    en: "Action is the foundational key to all success.",
    vi: "Hành động là chìa khóa nền tảng dẫn lối tới mọi thành công.",
    author: "Pablo Picasso",
    category: "growth"
  },
  {
    id: 12,
    en: "Success is the sum of small efforts, repeated day in and day out.",
    vi: "Thành công là tổng hợp của những nỗ lực nhỏ bé được lặp đi lặp lại ngày qua ngày.",
    author: "Robert Collier",
    category: "discipline"
  },
  {
    id: 13,
    en: "Change your thoughts and you change your world.",
    vi: "Thay đổi suy nghĩ của bạn và bạn sẽ thay đổi cả thế giới xung quanh mình.",
    author: "Norman Vincent Peale",
    category: "mindset"
  },
  {
    id: 14,
    en: "Knowledge of languages is the doorway to wisdom.",
    vi: "Hiểu biết ngôn ngữ chính là cánh cửa dẫn tới sự thông thái.",
    author: "Roger Bacon",
    category: "language"
  },
  {
    id: 15,
    en: "Do something today that your future self will thank you for.",
    vi: "Hãy làm điều gì đó ngày hôm nay để bản thân trong tương lai phải cảm ơn bạn.",
    author: "Sean Patrick Flanery",
    category: "discipline"
  },
  {
    id: 16,
    en: "Consistency is what transforms average into excellence.",
    vi: "Sự kiên trì bền bỉ chính là điều biến những điều bình thường thành xuất chúng.",
    author: "Tony Robbins",
    category: "discipline"
  },
  {
    id: 17,
    en: "The beautiful thing about learning is that nobody can take it away from you.",
    vi: "Điều tuyệt vời nhất của sự học là không ai có thể tước đoạt nó khỏi bạn.",
    author: "B.B. King",
    category: "learning"
  },
  {
    id: 18,
    en: "If you talk to a man in a language he understands, that goes to his head. If you talk to him in his language, that goes to his heart.",
    vi: "Nếu bạn nói bằng ngôn ngữ người khác hiểu, nó vào đầu họ. Nếu nói bằng tiếng mẹ đẻ của họ, nó chạm tới trái tim họ.",
    author: "Nelson Mandela",
    category: "language"
  },
  {
    id: 19,
    en: "It always seems impossible until it is done.",
    vi: "Mọi thứ dường như luôn là bất khả thi cho đến khi nó được hoàn thành.",
    author: "Nelson Mandela",
    category: "persistence"
  },
  {
    id: 20,
    en: "Mastery is not a function of genius or talent, it is a function of time and intense focus.",
    vi: "Sự tinh thông không đến từ thiên bẩm, mà là kết tinh của thời gian và sự tập trung cao độ.",
    author: "Robert Greene",
    category: "discipline"
  },
  {
    id: 21,
    en: "The only way to do great work is to love what you do.",
    vi: "Cách duy nhất để tạo nên những điều vĩ đại là hãy yêu thích công việc bạn làm.",
    author: "Steve Jobs",
    category: "growth"
  },
  {
    id: 22,
    en: "Learning a language is having one more window from which to look at the world.",
    vi: "Học một ngôn ngữ mới là có thêm một ô cửa sổ để chiêm ngưỡng thế giới.",
    author: "Chinese Proverb",
    category: "language"
  },
  {
    id: 23,
    en: "Focus on progress, not perfection.",
    vi: "Hãy tập trung vào sự tiến bộ mỗi ngày thay vì sự hoàn hảo tức thì.",
    author: "Bill Phillips",
    category: "mindset"
  },
  {
    id: 24,
    en: "He who moves not forward goes backward.",
    vi: "Người không tiến bước về phía trước chính là người đang tụt lùi lại phía sau.",
    author: "Johann Wolfgang von Goethe",
    category: "growth"
  },
  {
    id: 25,
    en: "Language is wine upon the lips.",
    vi: "Ngôn ngữ như men rượu ngọt ngào đọng lại trên đôi môi.",
    author: "Virginia Woolf",
    category: "language"
  },
  {
    id: 26,
    en: "Your habits will determine your future.",
    vi: "Những thói quen mỗi ngày sẽ định hình tương lai của chính bạn.",
    author: "Jack Canfield",
    category: "discipline"
  },
  {
    id: 27,
    en: "A different language is a different vision of life.",
    vi: "Một ngôn ngữ khác mở ra một lăng kính mới mẻ về cuộc đời.",
    author: "Federico Fellini",
    category: "language"
  },
  {
    id: 28,
    en: "Success doesn't come to you, you've got to go to it.",
    vi: "Thành công không tự tìm đến với bạn, bạn phải chủ động bước tới đón nhận nó.",
    author: "Marva Collins",
    category: "growth"
  },
  {
    id: 29,
    en: "Never give up on a dream just because of the time it will take to accomplish it.",
    vi: "Đừng bao giờ từ bỏ ước mơ chỉ vì cần nhiều thời gian để hoàn thành nó.",
    author: "Earl Nightingale",
    category: "persistence"
  },
  {
    id: 30,
    en: "With languages, you are at home anywhere.",
    vi: "Có trong tay ngôn ngữ, bạn sẽ cảm thấy như ở nhà tại bất cứ nơi đâu trên thế giới.",
    author: "Edward De Waal",
    category: "language"
  },
  {
    id: 31,
    en: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    vi: "Chúng ta là những gì chúng ta lặp đi lặp lại. Sự xuất sắc không phải là một hành động, mà là một thói quen.",
    author: "Aristotle",
    category: "discipline"
  },
  {
    id: 32,
    en: "Learning never exhausts the mind.",
    vi: "Sự học không bao giờ làm cạn kiệt tâm trí.",
    author: "Leonardo da Vinci",
    category: "learning"
  },
  {
    id: 33,
    en: "It does not matter how slowly you go as long as you do not stop.",
    vi: "Đi chậm bao nhiêu không quan trọng, miễn là bạn không dừng bước.",
    author: "Confucius",
    category: "persistence"
  },
  {
    id: 34,
    en: "Education is not the learning of facts, but the training of the mind to think.",
    vi: "Giáo dục không phải là học thuộc lòng các dữ kiện, mà là rèn luyện tâm trí cách suy nghĩ.",
    author: "Albert Einstein",
    category: "learning"
  },
  {
    id: 35,
    en: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    vi: "Thành công không phải là vĩnh viễn, thất bại không phải là dấu chấm hết: lòng can đảm bước tiếp mới là điều quyết định.",
    author: "Winston Churchill",
    category: "persistence"
  },
  {
    id: 36,
    en: "While we teach, we learn.",
    vi: "Khi chúng ta sẻ chia tri thức, chúng ta cũng đang tự học hỏi.",
    author: "Seneca",
    category: "learning"
  },
  {
    id: 37,
    en: "The soul becomes dyed with the color of its thoughts.",
    vi: "Tâm hồn bạn sẽ được nhuộm màu bởi chính những suy nghĩ của bạn.",
    author: "Marcus Aurelius",
    category: "mindset"
  },
  {
    id: 38,
    en: "Anyone who stops learning is old, whether at twenty or eighty.",
    vi: "Bất kỳ ai ngừng học hỏi đều già đi, dù ở tuổi hai mươi hay tám mươi.",
    author: "Henry Ford",
    category: "learning"
  },
  {
    id: 39,
    en: "A journey of a thousand miles begins with a single step.",
    vi: "Hành trình vạn dặm khởi đầu bằng một bước chân.",
    author: "Lao Tzu",
    category: "growth"
  },
  {
    id: 40,
    en: "Every artist was first an amateur.",
    vi: "Mọi bậc thầy nghệ thuật đều từng có xuất phát điểm là một người học việc nghiệp dư.",
    author: "Ralph Waldo Emerson",
    category: "growth"
  },
  {
    id: 41,
    en: "I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times.",
    vi: "Tôi không sợ người luyện 10.000 cú đá một lần, tôi chỉ sợ người luyện một cú đá 10.000 lần.",
    author: "Bruce Lee",
    category: "discipline"
  },
  {
    id: 42,
    en: "You can't use up creativity. The more you use, the more you have.",
    vi: "Sự sáng tạo là vô tận. Bạn càng dùng nhiều, bạn càng sở hữu nhiều hơn.",
    author: "Maya Angelou",
    category: "growth"
  },
  {
    id: 43,
    en: "Believe you can and you're halfway there.",
    vi: "Hãy tin rằng bạn có thể và bạn đã đi được một nửa chặng đường.",
    author: "Theodore Roosevelt",
    category: "mindset"
  },
  {
    id: 44,
    en: "Optimism is the faith that leads to achievement. Nothing can be done without hope and confidence.",
    vi: "Lạc quan là niềm tin dẫn đến thành tựu. Sẽ không thể làm được gì nếu thiếu hy vọng và sự tự tin.",
    author: "Helen Keller",
    category: "mindset"
  },
  {
    id: 45,
    en: "Only the educated are free.",
    vi: "Chỉ những người được giáo dục và có hiểu biết mới thực sự tự do.",
    author: "Epictetus",
    category: "learning"
  },
  {
    id: 46,
    en: "Education is not preparation for life; education is life itself.",
    vi: "Giáo dục không phải là sự chuẩn bị cho cuộc sống; giáo dục chính là cuộc sống.",
    author: "John Dewey",
    category: "learning"
  },
  {
    id: 47,
    en: "One child, one teacher, one book, one pen can change the world.",
    vi: "Một đứa trẻ, một người thầy, một cuốn sách và một cây bút có thể thay đổi cả thế giới.",
    author: "Malala Yousafzai",
    category: "learning"
  },
  {
    id: 48,
    en: "Learning another language is not only learning different words for the same things, but learning another way to think about things.",
    vi: "Học một ngôn ngữ mới không chỉ là học những từ ngữ khác cho cùng một sự vật, mà là học một cách tư duy mới về mọi điều.",
    author: "Flora Lewis",
    category: "language"
  },
  {
    id: 49,
    en: "You can never understand one language until you understand at least two.",
    vi: "Bạn không bao giờ có thể hiểu trọn vẹn một ngôn ngữ cho đến khi bạn hiểu ít nhất hai ngôn ngữ.",
    author: "Geoffrey Willans",
    category: "language"
  },
  {
    id: 50,
    en: "Language is the road map of a culture. It tells you where its people come from and where they are going.",
    vi: "Ngôn ngữ là tấm bản đồ của văn hóa, chỉ cho bạn biết con người đến từ đâu và họ đang hướng tới đâu.",
    author: "Rita Mae Brown",
    category: "language"
  },
  {
    id: 51,
    en: "A mind that is stretched by a new experience can never go back to its old dimensions.",
    vi: "Tâm trí một khi đã được mở rộng bởi trải nghiệm mới sẽ không bao giờ co lại về giới hạn ban đầu.",
    author: "Oliver Wendell Holmes",
    category: "learning"
  },
  {
    id: 52,
    en: "You do not rise to the level of your goals. You fall to the level of your systems.",
    vi: "Bạn không vươn tới tầm cao của mục tiêu. Bạn dừng lại ở đẳng cấp của hệ thống thói quen bạn xây dựng.",
    author: "James Clear",
    category: "discipline"
  },
  {
    id: 53,
    en: "Every action you take is a vote for the type of person you wish to become.",
    vi: "Mỗi hành động bạn thực hiện là một lá phiếu bầu cho hình mẫu con người bạn muốn trở thành.",
    author: "James Clear",
    category: "discipline"
  },
  {
    id: 54,
    en: "Becoming is better than being.",
    vi: "Quá trình nỗ lực vươn lên luôn tuyệt vời hơn sự an phận tự mãn.",
    author: "Carol Dweck",
    category: "mindset"
  },
  {
    id: 55,
    en: "Grit is passion and perseverance for very long-term goals.",
    vi: "Sự bền bỉ là niềm đam mê và lòng kiên trì dành cho những mục tiêu dài hạn.",
    author: "Angela Duckworth",
    category: "persistence"
  },
  {
    id: 56,
    en: "It is our choices that show what we truly are, far more than our abilities.",
    vi: "Chính những lựa chọn phản chiếu con người thật của chúng ta, hơn là tài năng vốn có.",
    author: "J.K. Rowling",
    category: "growth"
  },
  {
    id: 57,
    en: "Change your opinions, keep to your principles; change your leaves, keep intact your roots.",
    vi: "Hãy thay đổi quan điểm nhưng giữ vững nguyên tắc; hãy thay lá nhưng giữ trọn vẹn gốc rễ.",
    author: "Victor Hugo",
    category: "mindset"
  },
  {
    id: 58,
    en: "You are never too old to set another goal or to dream a new dream.",
    vi: "Bạn không bao giờ là quá già để đặt thêm một mục tiêu hay ấp ủ một giấc mơ mới.",
    author: "C.S. Lewis",
    category: "growth"
  },
  {
    id: 59,
    en: "It is never too late to be what you might have been.",
    vi: "Không bao giờ là quá muộn để trở thành con người mà bạn từng ao ước.",
    author: "George Eliot",
    category: "growth"
  },
  {
    id: 60,
    en: "Develop success from failures. Discouragement and failure are two of the surest stepping stones to success.",
    vi: "Hãy gây dựng thành công từ những thất bại. Chán nản và vấp ngã là hai bậc thang vững chắc nhất dẫn tới thành công.",
    author: "Dale Carnegie",
    category: "persistence"
  },
  {
    id: 61,
    en: "Procrastination is the thief of time.",
    vi: "Sự trì hoãn chính là kẻ trộm đánh cắp thời gian quý báu.",
    author: "Charles Dickens",
    category: "discipline"
  },
  {
    id: 62,
    en: "I walk slowly, but I never walk backward.",
    vi: "Tôi bước chậm, nhưng tôi không bao giờ bước lùi lại phía sau.",
    author: "Abraham Lincoln",
    category: "persistence"
  },
  {
    id: 63,
    en: "Life can only be understood backwards; but it must be lived forwards.",
    vi: "Cuộc đời chỉ có thể được thấu hiểu khi nhìn lại phía sau, nhưng phải được sống bằng cách hướng về phía trước.",
    author: "Soren Kierkegaard",
    category: "mindset"
  },
  {
    id: 64,
    en: "It has long been an axiom of mine that the little things are infinitely the most important.",
    vi: "Từ lâu tôi đã luôn tâm niệm rằng những chi tiết nhỏ bé lại mang tầm quan trọng vô cùng to lớn.",
    author: "Arthur Conan Doyle",
    category: "learning"
  },
  {
    id: 65,
    en: "In the midst of chaos, there is also opportunity.",
    vi: "Giữa tâm điểm của sự hỗn loạn luôn ẩn chứa những cơ hội bứt phá.",
    author: "Sun Tzu",
    category: "mindset"
  },
  {
    id: 66,
    en: "Great works are performed not by strength, but by perseverance.",
    vi: "Những công trình vĩ đại được tạo nên không phải nhờ sức mạnh, mà nhờ sự kiên trì bền bỉ.",
    author: "Samuel Johnson",
    category: "persistence"
  },
  {
    id: 67,
    en: "It is not in the stars to hold our destiny but in ourselves.",
    vi: "Số phận không nằm ở các vì sao chiếu mệnh mà nằm trong chính bản thân chúng ta.",
    author: "William Shakespeare",
    category: "growth"
  },
  {
    id: 68,
    en: "There is nothing impossible to him who will try.",
    vi: "Không có gì là bất khả thi đối với người luôn nỗ lực thử sức.",
    author: "Alexander the Great",
    category: "persistence"
  },
  {
    id: 69,
    en: "The mind is not a vessel to be filled, but a fire to be kindled.",
    vi: "Tâm trí không phải là chiếc bình cần lấp đầy, mà là ngọn lửa cần được thắp sáng.",
    author: "Plutarch",
    category: "learning"
  },
  {
    id: 70,
    en: "Fall seven times, stand up eight.",
    vi: "Bảy lần vấp ngã, tám lần đứng lên kiên cường.",
    author: "Japanese Proverb",
    category: "persistence"
  },
  {
    id: 71,
    en: "Practice makes perfect.",
    vi: "Luyện tập thường xuyên tạo nên sự thành thạo và hoàn hảo.",
    author: "Latin Proverb",
    category: "discipline"
  },
  {
    id: 72,
    en: "Where there is a will, there is a way.",
    vi: "Nơi nào có ý chí, nơi đó có con đường mở lối.",
    author: "English Proverb",
    category: "persistence"
  },
  {
    id: 73,
    en: "If you want to go fast, go alone. If you want to go far, go together.",
    vi: "Muốn đi nhanh hãy đi một mình. Muốn đi xa hãy đi cùng nhau.",
    author: "African Proverb",
    category: "growth"
  },
  {
    id: 74,
    en: "A new language is a new life.",
    vi: "Một ngôn ngữ mới mở ra một cuộc đời hoàn toàn mới.",
    author: "Persian Proverb",
    category: "language"
  },
  {
    id: 75,
    en: "Repetition is the mother of learning.",
    vi: "Sự lặp lại chính là cội nguồn của mọi sự học hỏi.",
    author: "Latin Proverb",
    category: "learning"
  },
  {
    id: 76,
    en: "The roots of education are bitter, but the fruit is sweet.",
    vi: "Gốc rễ của học hành tuy đắng cay, nhưng hoa trái thu hoạch lại vô cùng ngọt ngào.",
    author: "Greek Proverb",
    category: "learning"
  },
  {
    id: 77,
    en: "Practice is the best master.",
    vi: "Thực hành chính là người thầy hướng dẫn tuyệt vời nhất.",
    author: "German Proverb",
    category: "discipline"
  },
  {
    id: 78,
    en: "Có công mài sắt, có ngày nên kim.",
    vi: "Kiên trì rèn luyện và nhẫn nại ắt có ngày gặt hái thành quả rực rỡ.",
    author: "Vietnamese Proverb",
    category: "persistence"
  },
  {
    id: 79,
    en: "Học thầy không tày học bạn.",
    vi: "Học tập từ người thầy là quý báu, nhưng học hỏi từ bạn đồng hành cũng giá trị khôn cùng.",
    author: "Vietnamese Proverb",
    category: "learning"
  },
  {
    id: 80,
    en: "Chi va piano, va sano e va lontano.",
    vi: "Người tiến bước điềm tĩnh và vững vàng sẽ đi được rất xa và an toàn.",
    author: "Italian Proverb",
    category: "discipline"
  },
  {
    id: 81,
    en: "Genius is one percent inspiration and ninety-nine percent perspiration.",
    vi: "Thiên tài chỉ có một phần trăm là cảm hứng, còn chín mươi chín phần trăm là mồ hôi công sức.",
    author: "Thomas Edison",
    category: "discipline"
  },
  {
    id: 82,
    en: "I have not failed. I've just found 10,000 ways that won't work.",
    vi: "Tôi không thất bại. Tôi chỉ vừa tìm ra 10.000 cách chưa hiệu quả.",
    author: "Thomas Edison",
    category: "persistence"
  },
  {
    id: 83,
    en: "A person who never made a mistake never tried anything new.",
    vi: "Người chưa từng mắc lỗi là người chưa bao giờ dám thử nghiệm điều gì mới mẻ.",
    author: "Albert Einstein",
    category: "growth"
  },
  {
    id: 84,
    en: "In the middle of difficulty lies opportunity.",
    vi: "Nằm giữa những khó khăn thử thách chính là những cơ hội lớn.",
    author: "Albert Einstein",
    category: "mindset"
  },
  {
    id: 85,
    en: "Education is the most powerful weapon which you can use to change the world.",
    vi: "Giáo dục là vũ khí mạnh mẽ nhất mà bạn có thể dùng để thay đổi thế giới.",
    author: "Nelson Mandela",
    category: "learning"
  },
  {
    id: 86,
    en: "Motivation is what gets you started. Habit is what keeps you going.",
    vi: "Động lực là thứ giúp bạn bắt đầu. Thói quen là thứ giúp bạn tiếp bước không ngừng.",
    author: "Jim Rohn",
    category: "discipline"
  },
  {
    id: 87,
    en: "Don't wish it were easier; wish you were better.",
    vi: "Đừng mong mọi việc dễ dàng hơn; hãy ước rằng bản thân mình trở nên giỏi giang hơn.",
    author: "Jim Rohn",
    category: "growth"
  },
  {
    id: 88,
    en: "I am not a product of my circumstances. I am a product of my decisions.",
    vi: "Tôi không phải là sản phẩm của hoàn cảnh. Tôi là kết quả từ những quyết định của chính mình.",
    author: "Stephen Covey",
    category: "mindset"
  },
  {
    id: 89,
    en: "The key is not to prioritize what's on your schedule, but to schedule your priorities.",
    vi: "Bí quyết không phải là sắp xếp theo lịch trình có sẵn, mà là lên lịch trình cho những điều ưu tiên quan trọng.",
    author: "Stephen Covey",
    category: "discipline"
  },
  {
    id: 90,
    en: "We have two ears and one mouth so that we can listen twice as much as we speak.",
    vi: "Chúng ta có hai tai và một miệng để có thể lắng nghe nhiều gấp đôi khi nói.",
    author: "Epictetus",
    category: "learning"
  },
  {
    id: 91,
    en: "Luck is what happens when preparation meets opportunity.",
    vi: "May mắn là những gì xuất hiện khi sự chuẩn bị kỹ càng gặp gỡ cơ hội.",
    author: "Seneca",
    category: "growth"
  },
  {
    id: 92,
    en: "Waste no more time arguing what a good man should be. Be one.",
    vi: "Đừng lãng phí thêm thời gian tranh luận thế nào là người tốt. Hãy sống như một người tốt ngay bây giờ.",
    author: "Marcus Aurelius",
    category: "growth"
  },
  {
    id: 93,
    en: "Tell me and I forget, teach me and I may remember, involve me and I learn.",
    vi: "Nói với tôi tôi sẽ quên, dạy tôi tôi có thể nhớ, cho tôi tham gia vào tôi sẽ học được.",
    author: "Benjamin Franklin",
    category: "learning"
  },
  {
    id: 94,
    en: "By failing to prepare, you are preparing to fail.",
    vi: "Chuẩn bị sơ sài chính là bạn đang chuẩn bị đón nhận thất bại.",
    author: "Benjamin Franklin",
    category: "discipline"
  },
  {
    id: 95,
    en: "The future belongs to those who believe in the beauty of their dreams.",
    vi: "Tương lai thuộc về những ai có niềm tin son sắt vào vẻ đẹp của ước mơ.",
    author: "Eleanor Roosevelt",
    category: "mindset"
  },
  {
    id: 96,
    en: "Do one thing every day that scares you.",
    vi: "Hãy làm một điều gì đó mỗi ngày khiến bạn từng cảm thấy e dè hay ngần ngại.",
    author: "Eleanor Roosevelt",
    category: "growth"
  },
  {
    id: 97,
    en: "The two most important days in your life are the day you are born and the day you find out why.",
    vi: "Hai ngày quan trọng nhất trong cuộc đời bạn là ngày bạn chào đời và ngày bạn tìm ra lý do tại sao.",
    author: "Mark Twain",
    category: "mindset"
  },
  {
    id: 98,
    en: "Continuous improvement is better than delayed perfection.",
    vi: "Cải thiện liên tục mỗi ngày luôn tốt hơn là sự hoàn hảo bị trì hoãn.",
    author: "Mark Twain",
    category: "growth"
  },
  {
    id: 99,
    en: "The way to get started is to quit talking and begin doing.",
    vi: "Cách tốt nhất để bắt đầu là ngừng nói suông và bắt tay ngay vào hành động.",
    author: "Walt Disney",
    category: "growth"
  },
  {
    id: 100,
    en: "Go confidently in the direction of your dreams. Live the life you have imagined.",
    vi: "Hãy tự tin tiến về hướng của ước mơ. Hãy sống cuộc đời mà bạn từng hằng hình dung.",
    author: "Henry David Thoreau",
    category: "mindset"
  },
  {
    id: 101,
    en: "Mastering others is strength; mastering yourself is true power.",
    vi: "Hiểu người khác là thông minh; làm chủ bản thân mới là sức mạnh đích thực.",
    author: "Lao Tzu",
    category: "mindset"
  },
  {
    id: 102,
    en: "He who learns but does not think, is lost! He who thinks but does not learn is in great danger.",
    vi: "Học mà không suy ngẫm thì vô ích; suy ngẫm mà không chịu học tập thì hiểm nguy.",
    author: "Confucius",
    category: "learning"
  },
  {
    id: 103,
    en: "The only true wisdom is in knowing you know nothing.",
    vi: "Sự thông thái chân chính duy nhất là biết rằng mình vẫn còn biết rất ít.",
    author: "Socrates",
    category: "learning"
  },
  {
    id: 104,
    en: "The beginning is the most important part of the work.",
    vi: "Sự khởi đầu luôn là phần quan trọng nhất của mọi công trình.",
    author: "Plato",
    category: "growth"
  },
  {
    id: 105,
    en: "If I have seen further, it is by standing on the shoulders of giants.",
    vi: "Nếu tôi nhìn được xa hơn người khác, đó là nhờ đứng trên vai những người khổng lồ.",
    author: "Isaac Newton",
    category: "learning"
  },
  {
    id: 106,
    en: "Nothing in life is to be feared, it is only to be understood. Now is the time to understand more, so that we may fear less.",
    vi: "Không có gì trong cuộc sống đáng sợ hãi, mọi thứ sinh ra là để được thấu hiểu. Giờ là lúc hiểu nhiều hơn để bớt âu lo.",
    author: "Marie Curie",
    category: "mindset"
  },
  {
    id: 107,
    en: "Character cannot be developed in ease and quiet. Only through experience of trial and suffering can the soul be strengthened.",
    vi: "Tính cách không thể tôi luyện trong sự an nhàn tĩnh lặng. Chỉ qua thử thách, tâm hồn mới trở nên kiên cường.",
    author: "Helen Keller",
    category: "persistence"
  },
  {
    id: 108,
    en: "The greatest discovery of any generation is that a human being can alter his life by altering his attitude.",
    vi: "Khám phá vĩ đại nhất của nhân loại là con người có thể thay đổi cuộc đời bằng cách thay đổi thái độ sống.",
    author: "William James",
    category: "mindset"
  },
  {
    id: 109,
    en: "What lies behind you and what lies before you pales in comparison to what lies inside you.",
    vi: "Những gì sau lưng bạn và trước mắt bạn chẳng là gì so sánh với những gì tiềm ẩn bên trong bạn.",
    author: "Ralph Waldo Emerson",
    category: "mindset"
  },
  {
    id: 110,
    en: "Two roads diverged in a wood, and I took the one less traveled by, and that has made all the difference.",
    vi: "Hai lối rẽ trong rừng, và tôi đã chọn con đường ít người đi hơn, điều đó đã tạo nên mọi sự khác biệt.",
    author: "Robert Frost",
    category: "growth"
  },
  {
    id: 111,
    en: "A goal without a plan is just a wish.",
    vi: "Một mục tiêu không đi kèm kế hoạch hành động chỉ là một điều ước viển vông.",
    author: "Antoine de Saint-Exupéry",
    category: "discipline"
  },
  {
    id: 112,
    en: "When we are no longer able to change a situation, we are challenged to change ourselves.",
    vi: "Khi chúng ta không còn khả năng thay đổi hoàn cảnh, thử thách đặt ra là hãy thay đổi chính mình.",
    author: "Viktor Frankl",
    category: "mindset"
  }
];
