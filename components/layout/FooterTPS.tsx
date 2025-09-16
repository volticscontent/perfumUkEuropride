import Image from 'next/image'

interface FooterTPSProps {
  className?: string
}

export default function FooterTPS({ className = '' }: FooterTPSProps) {
  return (
    <footer className={`${className} bg-black`}>
      <Image
        src="/images/footer.jpg"
        alt="The Perfume Shop Footer"
        width={1920}
        height={600}
        className="w-full object-cover mb-20"
        priority={false}
      />
    </footer>
  )
}